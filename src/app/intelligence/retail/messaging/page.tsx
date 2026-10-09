import { MessagingApp } from "@/components/messaging/messaging-app";

export default function RetailMessagingPage() {
  return (
    <>
      <h1 className="ri-page-title">Messaging</h1>
      <p className="ri-page-sub">Realtime staff ↔ dealer conversations.</p>
      <div style={{ marginTop: "1.1rem" }}>
        <MessagingApp variant="staff" />
      </div>
    </>
  );
}
