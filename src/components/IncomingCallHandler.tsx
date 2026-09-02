import React from "react";
import CallScreen from "./call/CallScreen";
import MinimizedCallPill from "./call/MinimizedCallPill";

export default function IncomingCallHandler() {
  return (
    <>
      <CallScreen />
      <MinimizedCallPill />
    </>
  );
}
