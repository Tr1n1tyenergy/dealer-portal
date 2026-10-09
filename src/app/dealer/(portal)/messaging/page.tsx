import { MessagingApp } from "@/components/messaging/messaging-app";

export default function DealerMessagingPage() {
  return (
    <div style={{ padding: "0.25rem 0 1rem" }}>
      <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#0a235b", margin: 0 }}>
        Messaging
      </h1>
      <p style={{ marginTop: "0.35rem", color: "#64748b", fontSize: "0.9rem" }}>
        Chat with Trinity staff and other dealers.
      </p>
      <div style={{ marginTop: "1rem" }}>
        <MessagingApp variant="dealer" />
      </div>
    </div>
  );
}
