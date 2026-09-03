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
    }

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

    // We do not need BunkMatesRingtoneService anymore, remove if present
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

  // 3. Inject Java Files
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

      // Clean up old BunkMatesRingtoneService.java if it exists
      const oldServiceFile = path.join(javaDir, "BunkMatesRingtoneService.java");
      if (fs.existsSync(oldServiceFile)) {
        fs.unlinkSync(oldServiceFile);
      }

      // --- BunkMatesRingtoneModule.java ---
      const moduleCode = `package ${packageName};

import android.app.NotificationManager;
import android.content.Context;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class BunkMatesRingtoneModule extends ReactContextBaseJavaModule {
    public BunkMatesRingtoneModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "BunkMatesRingtone";
    }

    @ReactMethod
    public void start() {
        // Handled completely by Android NotificationManager via FLAG_INSISTENT now
    }

    @ReactMethod
    public void stop(String callId) {
        Context context = getReactApplicationContext();
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm != null) {
            if (callId != null && !callId.isEmpty()) {
                nm.cancel(callId.hashCode());
            }
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
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.onesignal.notifications.INotificationServiceExtension;
import com.onesignal.notifications.INotificationReceivedEvent;
import com.onesignal.notifications.IDisplayableMutableNotification;
import org.json.JSONObject;

public class NotificationServiceExtension implements INotificationServiceExtension {
    private static final String CHANNEL_ID = "bunkmates_insistent_call_channel_v1";

    @Override
    public void onNotificationReceived(INotificationReceivedEvent event) {
        IDisplayableMutableNotification notification = event.getNotification();
        JSONObject data = notification.getAdditionalData();

        if (data != null && data.has("type")) {
            String type = data.optString("type");
            Context context = event.getContext();
            NotificationManager nm = context.getSystemService(NotificationManager.class);

            if ("call".equals(type) || "incoming_call".equals(type) || "group_call".equals(type)) {
                Log.d("BunkMates", "Incoming call detected. Ensuring persistent Ringtone channel.");
                
                // 1. Ensure the correct Android channel exists for incoming calls
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
                    NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "Incoming Calls",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .build();
                    channel.setSound(ringtoneUri, audioAttributes);
                    nm.createNotificationChannel(channel);
                }

                // deterministic ID based on callId
                final int notificationId = data.has("callId") ? data.optString("callId").hashCode() : notification.getAndroidNotificationId();

                notification.setExtender(builder -> {
                    // Assign channel
                    builder.setChannelId(CHANNEL_ID);

                    // Set FullScreenIntent
                    Intent activityIntent = new Intent(context, MainActivity.class);
                    activityIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    activityIntent.putExtra("isCall", true);
                    
                    PendingIntent fullScreenIntent = PendingIntent.getActivity(
                        context,
                        0,
                        activityIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                    );
                    builder.setFullScreenIntent(fullScreenIntent, true);

                    // Use the exact Android-documented method to build and set FLAG_INSISTENT (No reflection)
                    Notification builtNotification = builder.build();
                    builtNotification.flags |= Notification.FLAG_INSISTENT;

                    // We let OneSignal proceed with its flow (so its listeners and UI buttons remain intact)
                    // But we schedule an immediate overwrite to apply the FLAG_INSISTENT natively
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        if (nm != null) {
                            nm.notify(notificationId, builtNotification);
                            Log.d("BunkMates", "Injected FLAG_INSISTENT notification");
                        }
                    }, 300); // 300ms delay guarantees OneSignal posts first, then we update it instantly

                    return builder;
                });

            } else if ("missed_call".equals(type) || "call_ended".equals(type)) {
                Log.d("BunkMates", "Missed call push detected. Canceling notification to stop ringtone.");
                if (nm != null) {
                    int notificationId = data.has("callId") ? data.optString("callId").hashCode() : notification.getAndroidNotificationId();
                    nm.cancel(notificationId);
                }
            }
        }
    }
}
`;
      fs.writeFileSync(path.join(javaDir, "NotificationServiceExtension.java"), extensionCode);

      // Delete the old static BunkMatesRingtone.java if it exists to clean up
      const oldRingtoneFile = path.join(javaDir, "BunkMatesRingtone.java");
      if (fs.existsSync(oldRingtoneFile)) {
        fs.unlinkSync(oldRingtoneFile);
      }

      return config;
    },
  ]);

  return config;
};

module.exports = createRunOncePlugin(withIncomingCallConfig, pkg.name, pkg.version);
