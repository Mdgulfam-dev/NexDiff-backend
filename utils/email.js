const nodemailer = require("nodemailer");

let transporter;

const getMailFrom = () =>
  process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

const isEmailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && getMailFrom());

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const auth =
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth,
  });

  return transporter;
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const getResumeAttachment = (resume) => {
  if (!resume?.dataUrl || !resume?.name) {
    return null;
  }

  const [metadata = "", data = ""] = String(resume.dataUrl).split(",");

  if (!data) {
    return null;
  }

  return {
    filename: resume.name,
    content: Buffer.from(data, "base64"),
    contentType: metadata.match(/^data:([^;]+);base64$/)?.[1] || resume.type,
  };
};

const buildApplicationRows = (application) =>
  [
    ["Name", application.name],
    ["Phone", application.phone],
    ["Email", application.email],
    ["Job ID", application.jobId],
    ["Role", application.role],
    ["Experience", application.experience],
    ["Portfolio", application.portfolio],
    ["Message", application.message],
  ]
    .filter(([, value]) => String(value || "").trim())
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;font-weight:700;">${label}</td><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

const sendCareerApplicationEmails = async (application) => {
  if (!isEmailConfigured()) {
    console.warn("Career application email skipped: SMTP_HOST, SMTP_PORT, and MAIL_FROM/SMTP_USER are required.");
    return { skipped: true };
  }

  const mailer = getTransporter();
  const from = getMailFrom();
  const notifyTo = process.env.CAREERS_NOTIFY_EMAIL || process.env.MAIL_TO || from;
  const applicantEmail = String(application.email || "").trim();
  const attachment = getResumeAttachment(application.resume);
  const rows = buildApplicationRows(application);
  const role = application.role || "job role";
  const applicantName = application.name || "Candidate";

  const messages = [
    mailer.sendMail({
      from,
      to: notifyTo,
      subject: `New job application: ${applicantName} for ${role}`,
      text: [
        "A new job application was submitted.",
        "",
        `Name: ${application.name || "Not specified"}`,
        `Phone: ${application.phone || "Not specified"}`,
        `Email: ${application.email || "Not specified"}`,
        `Job ID: ${application.jobId || "Not specified"}`,
        `Role: ${application.role || "Not specified"}`,
        `Experience: ${application.experience || "Not specified"}`,
        `Portfolio: ${application.portfolio || "Not specified"}`,
        `Message: ${application.message || "Not specified"}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#101312;">
          <h2 style="margin:0 0 16px;">New job application</h2>
          <table style="border-collapse:collapse;">${rows}</table>
        </div>
      `,
      attachments: attachment ? [attachment] : [],
    }),
  ];

  if (isValidEmail(applicantEmail)) {
    messages.push(
      mailer.sendMail({
        from: `"NexDiff Careers" <${from}>`,
        to: applicantEmail,
        subject: `Application Received – ${role} at NexDiff`,
        text: [
          `Hello ${applicantName},`,
          "",
          "Thank you for your interest in NexDiff.",
          `We have successfully received your application for the ${role} position.`,
          "",
          "Our recruitment team will review your profile and contact you if your qualifications match our current requirements.",
          "",
          "Application Summary:",
          `• Role: ${role}`,
          `• Job ID: ${application.jobId || "N/A"}`,
          "",
          "Thank you for considering NexDiff as the next step in your career journey.",
          "",
          "Best regards,",
          "NexDiff Talent Acquisition Team",
          "https://nexdiff.com",
        ].join("\n"),
        html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;">
        <h2 style="color:#2563eb;">Application Received</h2>

        <p>Hello ${escapeHtml(applicantName)},</p>

        <p>
          Thank you for your interest in <strong>NexDiff</strong>.
          We have successfully received your application for the
          <strong>${escapeHtml(role)}</strong> position.
        </p>

        <p>
          Our recruitment team will review your profile and contact you if your
          qualifications match our current requirements.
        </p>

        <div style="background:#f8fafc;padding:15px;border-radius:8px;margin:20px 0;">
          <h3 style="margin-top:0;">Application Summary</h3>
          <p><strong>Role:</strong> ${escapeHtml(role)}</p>
          <p><strong>Job ID:</strong> ${escapeHtml(application.jobId || "N/A")}</p>
        </div>

        <p>
          Thank you for considering NexDiff as the next step in your career journey.
        </p>

        <p>
          Best regards,<br>
          <strong>NexDiff Talent Acquisition Team</strong>
        </p>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">

        <p style="font-size:12px;color:#6b7280;">
          This is an automated confirmation email. Please do not reply directly to this message.
        </p>
      </div>
    `,
      }),
    );
  }

  const results = await Promise.allSettled(messages);
  const failed = results.filter((result) => result.status === "rejected");

  if (failed.length) {
    console.error("Career application email failed:", failed.map((result) => result.reason?.message || result.reason));
  }

  return {
    sent: results.length - failed.length,
    failed: failed.length,
  };
};

module.exports = {
  sendCareerApplicationEmails,
};
