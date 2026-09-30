const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
  createRunOncePlugin,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const pkg = require("../package.json");

const withIncomingCallConfig = (config) => {
  // 1. Modify AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];
    const mainActivity = mainApplication.activity.find(
      (a) => a.$["android:name"] === ".MainActivity"
    );

    if (mainActivity) {
      mainActivity.$["android:showWhenLocked"] = "true";
      mainActivity.$["android:turnScreenOn"] = "true";
      mainActivity.$["android:showOnLockScreen"] = "true";

      // Add APP_MAPS category to main launcher intent-filter for Android/OnePlus system categorization
      if (mainActivity["intent-filter"]) {
        const launcherFilter = mainActivity["intent-filter"].find(
          (f) =>
            f.action &&
            f.action.some((a) => a.$["android:name"] === "android.intent.action.MAIN")
        );
        if (launcherFilter && launcherFilter.category) {
          const hasAppMaps = launcherFilter.category.some(
            (c) => c.$["android:name"] === "android.intent.category.APP_MAPS"
          );
          if (!hasAppMaps) {
            launcherFilter.category.push({
              $: { "android:name": "android.intent.category.APP_MAPS" },
            });
          }
        }

        // Add geo: mapping scheme intent-filter so launchers recognize app as travel/maps provider
        const hasGeo = mainActivity["intent-filter"].some(
          (f) => f.data && f.data.some((d) => d.$["android:scheme"] === "geo")
        );
        if (!hasGeo) {
          mainActivity["intent-filter"].push({
            action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
            category: [
              { $: { "android:name": "android.intent.category.DEFAULT" } },
              { $: { "android:name": "android.intent.category.BROWSABLE" } },
            ],
            data: [{ $: { "android:scheme": "geo" } }],
          });
        }
      }
    }

    // Set Android OS Application Category (Maps & Navigation / Travel)
    mainApplication.$["android:appCategory"] = "maps";

    // Add OneSignal Extension meta-data
    if (!mainApplication["meta-data"]) {
      mainApplication["meta-data"] = [];
    }
    const hasExt = mainApplication["meta-data"].find(
      (m) => m.$["android:name"] === "com.onesignal.NotificationServiceExtension"
    );
    if (!hasExt) {
      mainApplication["meta-data"].push({
        $: {
          "android:name": "com.onesignal.NotificationServiceExtension",
          "android:value": "com.bm.bunkmates.NotificationServiceExtension",
        },
      });
    }

    // Add CallActionReceiver to manifest receivers
    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }
    const hasReceiver = mainApplication.receiver.find(
      (r) => r.$["android:name"] === ".CallActionReceiver"
    );
    if (!hasReceiver) {
      mainApplication.receiver.push({
        $: {
          "android:name": ".CallActionReceiver",
          "android:exported": "false",
        },
      });
    }

    // Add Travel App Category metadata for launchers & OS categorization engines (OnePlus, ColorOS, Oppo, Android)
    const vendorCategoryMetas = [
      { name: "android.app.category", value: "travel" },
      { name: "appCategory", value: "maps" },
      { name: "com.android.launcher.CATEGORY", value: "TRAVEL" },
      { name: "com.oplus.launcher.category", value: "travel" },
      { name: "com.oppo.launcher.category", value: "travel" },
      { name: "com.coloros.launcher.category", value: "travel" },
      { name: "com.oneplus.launcher.category", value: "travel" },
      { name: "app_category", value: "travel" },
      { name: "category", value: "Travel" },
    ];

    vendorCategoryMetas.forEach((meta) => {
      const exists = mainApplication["meta-data"].find(
        (m) => m.$["android:name"] === meta.name
      );
      if (!exists) {
        mainApplication["meta-data"].push({
          $: {
            "android:name": meta.name,
            "android:value": meta.value,
          },
        });
      }
    });

    // Clean up old services if present
    if (mainApplication.service) {
      mainApplication.service = mainApplication.service.filter(
        (s) => s.$["android:name"] !== ".BunkMatesRingtoneService"
      );
    }

    return config;
  });

  // 2. Modify MainApplication.kt to register BunkMatesPackage
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes("import com.bm.bunkmates.BunkMatesPackage")) {
      contents = contents.replace(
        "import com.facebook.react.ReactPackage",
        "import com.facebook.react.ReactPackage\nimport com.bm.bunkmates.BunkMatesPackage"
      );
    }

    if (!contents.includes("add(BunkMatesPackage())")) {
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        "PackageList(this).packages.apply {\n          add(BunkMatesPackage())"
      );
    }

    config.modResults.contents = contents;
    return config;
  });

  // 3. Inject Java Files & Assets
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packageName = config.android?.package || "com.bm.bunkmates";
      const packagePath = packageName.replace(/\./g, "/");
      const javaDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "java",
        packagePath
      );

      if (!fs.existsSync(javaDir)) {
        fs.mkdirSync(javaDir, { recursive: true });
      }

      // Ensure res/raw exists and contains custom call_ringtone.wav
      const rawDir = path.join(projectRoot, "android", "app", "src", "main", "res", "raw");
      if (!fs.existsSync(rawDir)) {
        fs.mkdirSync(rawDir, { recursive: true });
      }
      const rawAudioDest = path.join(rawDir, "call_ringtone.wav");
      const assetAudioSrc = path.join(projectRoot, "assets", "sounds", "call_ringtone.wav");
      if (fs.existsSync(assetAudioSrc) && !fs.existsSync(rawAudioDest)) {
        fs.copyFileSync(assetAudioSrc, rawAudioDest);
      }

      // --- CallActionReceiver.java ---
      const receiverCode = `package ${packageName};

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class CallActionReceiver extends BroadcastReceiver {
    private static final String TAG = "BunkMatesCallReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.d(TAG, "CallActionReceiver received action: " + action);

        if ("ACTION_DECLINE_CALL".equals(action)) {
            String callId = intent.getStringExtra("callId");
            int notificationId = intent.getIntExtra("notificationId", 0);

            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                if (notificationId != 0) {
                    nm.cancel(notificationId);
                }
                if (callId != null && !callId.isEmpty()) {
                    nm.cancel(callId.hashCode());
                }
            }

            BunkMatesRingtoneModule.stopRingtoneDirectly(context, callId);
            Log.d(TAG, "Decline action handled successfully for call: " + callId);
        }
    }
}
`;
      fs.writeFileSync(path.join(javaDir, "CallActionReceiver.java"), receiverCode);

      // --- BunkMatesRingtoneModule.java ---
      const moduleCode = `package ${packageName};

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.util.Log;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

public class BunkMatesRingtoneModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BunkMatesRingtone";
    private static MediaPlayer activePlayer = null;

    private static String latestCallAction = null;
    private static String latestCallId = null;
    private static String latestCallType = null;
    private static String latestCallerName = null;

    public BunkMatesRingtoneModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "BunkMatesRingtone";
    }

    public static void setCallAction(String action, String callId, String callType, String callerName) {
        latestCallAction = action;
        latestCallId = callId;
        latestCallType = callType;
        latestCallerName = callerName;
        Log.d(TAG, "setCallAction: action=" + action + ", callId=" + callId);
    }

    @ReactMethod
    public void getInitialCallAction(Promise promise) {
        try {
            WritableMap map = Arguments.createMap();
            map.putString("action", latestCallAction);
            map.putString("callId", latestCallId);
            map.putString("callType", latestCallType);
            map.putString("callerName", latestCallerName);

            latestCallAction = null;
            latestCallId = null;
            latestCallType = null;
            latestCallerName = null;

            promise.resolve(map);
        } catch (Exception e) {
            promise.reject("CALL_ACTION_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void start() {
        try {
            Context context = getReactApplicationContext();
            stopInternal();

            int soundResId = context.getResources().getIdentifier("call_ringtone", "raw", context.getPackageName());
            if (soundResId != 0) {
                activePlayer = MediaPlayer.create(context, soundResId);
            } else {
                Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/raw/call_ringtone");
                activePlayer = new MediaPlayer();
                activePlayer.setDataSource(context, soundUri);
                activePlayer.prepare();
            }

            if (activePlayer != null) {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setLegacyStreamType(AudioManager.STREAM_RING)
                        .build();
                activePlayer.setAudioAttributes(audioAttributes);
                activePlayer.setLooping(true);
                activePlayer.start();
                Log.d(TAG, "Started custom app-specific ringtone (call_ringtone) natively");
            } else {
                Log.w(TAG, "Could not create MediaPlayer for call_ringtone");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting custom ringtone", e);
        }
    }

    private static synchronized void stopInternal() {
        try {
            if (activePlayer != null) {
                if (activePlayer.isPlaying()) {
                    activePlayer.stop();
                }
                activePlayer.reset();
                activePlayer.release();
                activePlayer = null;
                Log.d(TAG, "Stopped custom ringtone");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in stopInternal", e);
            activePlayer = null;
        }
    }

    public static void stopRingtoneDirectly(Context context, String callId) {
        stopInternal();
        if (context != null) {
            android.app.NotificationManager nm = (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && callId != null && !callId.isEmpty()) {
                nm.cancel(callId.hashCode());
            }
        }
    }

    @ReactMethod
    public void stop(String callId) {
        try {
            Context context = getReactApplicationContext();
            stopRingtoneDirectly(context, callId);
        } catch (Exception e) {
            Log.e(TAG, "Error stopping custom ringtone", e);
        }
    }
}
`;
      fs.writeFileSync(path.join(javaDir, "BunkMatesRingtoneModule.java"), moduleCode);

      // --- BunkMatesPackage.java ---
      const packageCode = `package ${packageName};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class BunkMatesPackage implements ReactPackage {
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new BunkMatesRingtoneModule(reactContext));
        return modules;
    }
}
`;
      fs.writeFileSync(path.join(javaDir, "BunkMatesPackage.java"), packageCode);

      // --- NotificationServiceExtension.java ---
      const extensionCode = `package ${packageName};

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.onesignal.notifications.INotificationServiceExtension;
import com.onesignal.notifications.INotificationReceivedEvent;
import com.onesignal.notifications.IDisplayableMutableNotification;
import org.json.JSONObject;
import java.net.URLEncoder;
import java.util.List;

public class NotificationServiceExtension implements INotificationServiceExtension {
    private static final String TAG = "BunkMatesNotification";
    public static final String CALL_CHANNEL_ID = "bunkmates_call_ringtone_channel_v7";
    public static final String GENERAL_CHANNEL_ID = "bunkmates_default_channel_v1";

    private boolean isAppInForeground(Context context) {
        try {
            android.app.ActivityManager activityManager = (android.app.ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            if (activityManager == null) return false;
            List<android.app.ActivityManager.RunningAppProcessInfo> appProcesses = activityManager.getRunningAppProcesses();
            if (appProcesses == null) return false;
            final String packageName = context.getPackageName();
            for (android.app.ActivityManager.RunningAppProcessInfo appProcess : appProcesses) {
                if (appProcess.importance == android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND && appProcess.processName.equals(packageName)) {
                    return true;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking app foreground state", e);
        }
        return false;
    }

    private void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm == null) return;

            NotificationChannel callChannel = nm.getNotificationChannel(CALL_CHANNEL_ID);
            if (callChannel == null) {
                callChannel = new NotificationChannel(
                    CALL_CHANNEL_ID,
                    "Incoming Calls",
                    NotificationManager.IMPORTANCE_HIGH
                );
                callChannel.setDescription("Heads-up banner alerts and ringtone for incoming BunkMates calls");
                Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/raw/call_ringtone");
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build();
                callChannel.setSound(soundUri, audioAttributes);
                callChannel.enableVibration(true);
                callChannel.setVibrationPattern(new long[]{0, 1000, 800, 1000, 800, 1000});
                callChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                callChannel.setBypassDnd(true);
                callChannel.setShowBadge(true);
                nm.createNotificationChannel(callChannel);
            }

            NotificationChannel generalChannel = nm.getNotificationChannel(GENERAL_CHANNEL_ID);
            if (generalChannel == null) {
                generalChannel = new NotificationChannel(
                    GENERAL_CHANNEL_ID,
                    "Messages & Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                );
                generalChannel.setDescription("Chat messages and general notifications");
                generalChannel.enableVibration(true);
                generalChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                generalChannel.setShowBadge(true);
                nm.createNotificationChannel(generalChannel);
            }
        }
    }

    @Override
    public void onNotificationReceived(INotificationReceivedEvent event) {
        IDisplayableMutableNotification notification = event.getNotification();
        JSONObject data = notification.getAdditionalData();
        Context context = event.getContext();
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        ensureChannels(context);

        if (data != null && data.has("type")) {
            String type = data.optString("type");

            if ("call".equals(type) || "incoming_call".equals(type) || "group_call".equals(type)) {
                if (isAppInForeground(context)) {
                    Log.d(TAG, "App is in foreground. Suppressing native push. JS will handle Call UI.");
                    event.preventDefault();
                    return;
                }

                final String callId = data.optString("callId", "");
                final String callerName = data.optString("callerName", "BunkMate");
                final String callType = data.optString("callType", "audio");
                final int notificationId = callId.isEmpty() ? notification.getAndroidNotificationId() : callId.hashCode();

                Log.d(TAG, "Incoming call received in killed/background state. Building heads-up call notification for: " + callerName);

                Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/raw/call_ringtone");

                Intent answerIntent = new Intent(context, MainActivity.class);
                answerIntent.setAction("ACTION_ACCEPT_CALL");
                answerIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                answerIntent.putExtra("isCall", true);
                answerIntent.putExtra("callAction", "ACCEPT");
                answerIntent.putExtra("callId", callId);
                answerIntent.putExtra("callType", callType);
                answerIntent.putExtra("callerName", callerName);
                try {
                    answerIntent.setData(Uri.parse("bunkmates://call?callId=" + callId + "&action=ACCEPT&callType=" + callType + "&callerName=" + URLEncoder.encode(callerName, "UTF-8")));
                } catch (Exception ignored) {}

                PendingIntent answerPendingIntent = PendingIntent.getActivity(
                    context,
                    (callId + "_accept").hashCode(),
                    answerIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                Intent declineIntent = new Intent(context, CallActionReceiver.class);
                declineIntent.setAction("ACTION_DECLINE_CALL");
                declineIntent.putExtra("callId", callId);
                declineIntent.putExtra("notificationId", notificationId);

                PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
                    context,
                    (callId + "_decline").hashCode(),
                    declineIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                Intent fullScreenIntent = new Intent(context, MainActivity.class);
                fullScreenIntent.setAction("ACTION_INCOMING_CALL");
                fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                fullScreenIntent.putExtra("isCall", true);
                fullScreenIntent.putExtra("callAction", "INCOMING");
                fullScreenIntent.putExtra("callId", callId);
                fullScreenIntent.putExtra("callType", callType);
                fullScreenIntent.putExtra("callerName", callerName);
                try {
                    fullScreenIntent.setData(Uri.parse("bunkmates://call?callId=" + callId + "&action=INCOMING&callType=" + callType));
                } catch (Exception ignored) {}

                PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                    context,
                    (callId + "_fs").hashCode(),
                    fullScreenIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                notification.setExtender(builder -> {
                    builder.setChannelId(CALL_CHANNEL_ID);
                    builder.setPriority(NotificationCompat.PRIORITY_MAX);
                    builder.setCategory(NotificationCompat.CATEGORY_CALL);
                    builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                    builder.setOngoing(true);
                    builder.setAutoCancel(false);
                    builder.setSound(soundUri);
                    builder.setFullScreenIntent(fullScreenPendingIntent, true);
                    builder.setContentIntent(fullScreenPendingIntent);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        androidx.core.app.Person caller = new androidx.core.app.Person.Builder()
                                .setName(callerName)
                                .setImportant(true)
                                .build();

                        builder.setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declinePendingIntent, answerPendingIntent));

                        if (builder.mActions != null) {
                            builder.mActions.clear();
                        }
                    } else {
                        if (builder.mActions != null) {
                            builder.mActions.clear();
                        }
                        builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent);
                        builder.addAction(android.R.drawable.ic_menu_call, "Answer", answerPendingIntent);
                    }

                    Notification built = builder.build();
                    built.flags |= Notification.FLAG_INSISTENT;

                    if (nm != null) {
                        nm.notify(notificationId, built);
                        Log.d(TAG, "Successfully notified incoming call with custom ringtone and FLAG_INSISTENT");
                    }

                    return builder;
                });

            } else if ("missed_call".equals(type) || "call_ended".equals(type)) {
                Log.d(TAG, "Missed call / call ended. Stopping ringtone and clearing notification.");
                final String callId = data.optString("callId", "");
                final int notificationId = callId.isEmpty() ? notification.getAndroidNotificationId() : callId.hashCode();
                if (nm != null) {
                    nm.cancel(notificationId);
                }
                BunkMatesRingtoneModule.stopRingtoneDirectly(context, callId);
            } else {
                // General notifications (Chats, Reminders, Friend Requests, etc.)
                notification.setExtender(builder -> {
                    builder.setChannelId(GENERAL_CHANNEL_ID);
                    builder.setPriority(NotificationCompat.PRIORITY_HIGH);
                    builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                    builder.setAutoCancel(true);
                    return builder;
                });
            }
        } else {
            notification.setExtender(builder -> {
                builder.setChannelId(GENERAL_CHANNEL_ID);
                builder.setPriority(NotificationCompat.PRIORITY_HIGH);
                builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                builder.setAutoCancel(true);
                return builder;
            });
        }
    }
}
`;
      fs.writeFileSync(path.join(javaDir, "NotificationServiceExtension.java"), extensionCode);

      return config;
    },
  ]);

  return config;
};

module.exports = createRunOncePlugin(withIncomingCallConfig, pkg.name, pkg.version);
