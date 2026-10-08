import { describe, expect, it } from "vitest";
import { bookingConfirmationEmail, ownerNotificationEmail, reminderEmail, rescheduleEmail } from "./templates";

const data = {
  customerName: "Jana <script>Nováková</script>",
  customerEmail: "jana@example.cz",
  customerPhone: "+420 777 123 456",
  serviceName: "Dámský střih",
  durationMinutes: 60,
  priceCzk: 650,
  startsAt: "2026-10-14T11:00:00.000Z", // 13:00 in Prague
  business: {
    name: "Kadeřnictví U Nůžek",
    slug: "u-nuzek",
    address: "Dlouhá 12, Praha 1",
    phone: "+420 602 111 222",
    timezone: "Europe/Prague",
    notificationEmail: "salon@example.cz",
  },
  siteUrl: "https://rezervo.example",
};

describe("email templates", () => {
  it("renders the customer confirmation in the business timezone", () => {
    const email = bookingConfirmationEmail(data);
    expect(email.to).toBe("jana@example.cz");
    expect(email.replyTo).toBe("salon@example.cz");
    expect(email.subject).toContain("14. října v 13:00");
    expect(email.text).toContain("Cena: 650");
    expect(email.html).toContain("Dlouhá 12, Praha 1");
  });

  it("escapes user input in HTML", () => {
    const { html } = bookingConfirmationEmail(data);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("sends the owner notification to the business", () => {
    const email = ownerNotificationEmail(data);
    expect(email.to).toBe("salon@example.cz");
    expect(email.replyTo).toBe("jana@example.cz");
    expect(email.text).toContain("+420 777 123 456");
  });

  it("builds reminder and reschedule messages", () => {
    expect(reminderEmail(data).subject).toContain("zítra v 13:00");
    expect(rescheduleEmail(data, "2026-10-13T07:00:00.000Z").text).toContain("13. října v 9:00");
  });
});
