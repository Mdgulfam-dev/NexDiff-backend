const nodemailer = require("nodemailer");

let transporter;

const getMailFrom = () =>
  process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

const isEmailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && getMailFrom());

const shouldSendInternalNotifications = () =>
  String(process.env.SEND_INTERNAL_NOTIFY_EMAILS || "true").toLowerCase() !== "false";

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

const formatList = (value) => {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value;
};

const formatAmount = (amount, isFree) => {
  if (isFree || Number(amount) === 0) {
    return "Free";
  }

  return `Rs ${amount}`;
};

const buildPlanRequestRows = (request) =>
  [
    ["Plan", request.planName],
    ["Package", request.packageLabel],
    ["Amount", formatAmount(request.amount, request.isFree)],
    ["Name", request.name],
    ["Phone", request.phone],
    ["Email", request.email],
    ["Business", request.businessName],
    ["Niche", request.niche],
    ["Account Start Date", request.accountStartDate],
    ["Platform", formatList(request.platform)],
    ["Profile Links", request.profileLink],
    ["Content Type", formatList(request.contentType)],
    ["Goal", formatList(request.goal)],
    ["Issue", request.issue],
    ["Requirement", request.requirement],
    ["Payment Screenshot", request.paymentScreenshotName || (request.isFree ? "Not required" : "")],
  ]
    .filter(([, value]) => String(value || "").trim())
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;font-weight:700;vertical-align:top;">${label}</td><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

const sendContactRequestEmails = async (request) => {
  if (!isEmailConfigured()) {
    console.warn("Contact request email skipped: SMTP_HOST, SMTP_PORT, and MAIL_FROM/SMTP_USER are required.");
    return { skipped: true };
  }

  const mailer = getTransporter();
  const from = getMailFrom();
  const customerEmail = String(request.email || "").trim();
  const customerName = request.name || "Customer";
  const service = request.service || "Project inquiry";

  const messages = [];

  if (isValidEmail(customerEmail)) {
    messages.push({
      type: "customer",
      promise: mailer.sendMail({
        from: `"NexDiff" <${from}>`,
        to: customerEmail,
        subject: "We received your project brief - NexDiff",
        text: [
          `Hello ${customerName},`,
          "",
          "Thank you for contacting NexDiff.",
          `We have received your project brief for ${service}. Our team will review your requirements and contact you soon with the next steps.`,
          "",
          "Submission Summary:",
          `Service: ${service}`,
          `Budget: ${request.budget || "Not specified"}`,
          `Urgency: ${request.urgency || "Not specified"}`,
          "",
          "Best regards,",
          "Team NexDiff",
          "https://nexdiff.com",
        ].join("\n"),
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;">
            <p>Hello ${escapeHtml(customerName)},</p>
            <p>Thank you for contacting <strong>NexDiff</strong>.</p>
            <p>We have received your project brief for <strong>${escapeHtml(service)}</strong>. Our team will review your requirements and contact you soon with the next steps.</p>
            <div style="background:#f8fafc;padding:15px;border-radius:8px;margin:20px 0;">
              <h3 style="margin-top:0;color:#101312;">Submission Summary</h3>
              <p><strong>Service:</strong> ${escapeHtml(service)}</p>
              <p><strong>Budget:</strong> ${escapeHtml(request.budget || "Not specified")}</p>
              <p><strong>Urgency:</strong> ${escapeHtml(request.urgency || "Not specified")}</p>
            </div>
            <p>Best regards,<br><strong>Team NexDiff</strong><br><a href="https://nexdiff.com/" style="color:#2563eb;">https://nexdiff.com</a></p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">
            <p style="font-size:12px;color:#6b7280;"><em>This is an automated confirmation email. Please do not reply directly to this message.</em></p>
          </div>
        `,
      }),
    });
  } else {
    console.warn("Contact request customer email skipped: invalid customer email.");
  }

  const results = await Promise.all(
    messages.map((message) =>
      message.promise
        .then((info) => ({
          type: message.type,
          status: "fulfilled",
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
        }))
        .catch((error) => ({
          type: message.type,
          status: "rejected",
          reason: error,
        })),
    ),
  );
  const failed = results.filter((result) => result.status === "rejected");
  const customerResult = results.find((result) => result.type === "customer");

  if (failed.length) {
    console.error("Contact request email failed:", failed.map((result) => result.reason?.message || result.reason));
  }

  return {
    sent: results.length - failed.length,
    failed: failed.length,
    customerSent: customerResult?.status === "fulfilled",
    customerMessageId: customerResult?.messageId,
  };
};

const sendCareerApplicationEmails = async (application) => {
  if (!isEmailConfigured()) {
    console.warn("Career application email skipped: SMTP_HOST, SMTP_PORT, and MAIL_FROM/SMTP_USER are required.");
    return { skipped: true };
  }

  const mailer = getTransporter();
  const from = getMailFrom();
  const applicantEmail = String(application.email || "").trim();
  const role = application.role || "job role";
  const applicantName = application.name || "Candidate";

  const messages = [];

  if (shouldSendInternalNotifications()) {
    const notifyTo = process.env.CAREERS_NOTIFY_EMAIL || process.env.MAIL_TO || from;
    const attachment = getResumeAttachment(application.resume);
    const rows = buildApplicationRows(application);

    messages.push(
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
    );
  }

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

const sendPlanRequestEmails = async (request) => {
  if (!isEmailConfigured()) {
    console.warn("Plan request email skipped: SMTP_HOST, SMTP_PORT, and MAIL_FROM/SMTP_USER are required.");
    return { skipped: true };
  }

  const mailer = getTransporter();
  const from = getMailFrom();
  const customerEmail = String(request.email || "").trim();
  const planName = request.planName || "Plan Request";
  const customerName = request.name || "Customer";
  const amount = formatAmount(request.amount, request.isFree);
  const packageLabel = request.packageLabel || "N/A";
  const reviewMessage = request.isFree
    ? "No payment proof is required for this request."
    : "Our team will also verify the submitted payment proof before proceeding.";

  const messages = [];

  if (shouldSendInternalNotifications()) {
    const notifyTo =
      process.env.PLAN_REQUEST_NOTIFY_EMAIL ||
      process.env.MAIL_TO ||
      process.env.CAREERS_NOTIFY_EMAIL ||
      from;
    const rows = buildPlanRequestRows(request);

    messages.push(
      {
        type: "internal",
        promise: mailer.sendMail({
          from,
          to: notifyTo,
          subject: `New plan request: ${planName} - ${customerName}`,
          text: [
            "A new plan request was submitted.",
            "",
            `Plan: ${request.planName || "Not specified"}`,
            `Package: ${request.packageLabel || "Not specified"}`,
            `Amount: ${amount}`,
            `Name: ${request.name || "Not specified"}`,
            `Phone: ${request.phone || "Not specified"}`,
            `Email: ${request.email || "Not specified"}`,
            `Business: ${request.businessName || "Not specified"}`,
            `Niche: ${request.niche || "Not specified"}`,
            `Account Start Date: ${request.accountStartDate || "Not specified"}`,
            `Platform: ${formatList(request.platform) || "Not specified"}`,
            `Profile Links: ${request.profileLink || "Not specified"}`,
            `Content Type: ${formatList(request.contentType) || "Not specified"}`,
            `Goal: ${formatList(request.goal) || "Not specified"}`,
            `Issue: ${request.issue || "Not specified"}`,
            `Requirement: ${request.requirement || "Not specified"}`,
            `Payment Screenshot: ${request.paymentScreenshotName || (request.isFree ? "Not required" : "Not specified")}`,
          ].join("\n"),
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#101312;">
              <h2 style="margin:0 0 16px;">New plan request</h2>
              <table style="border-collapse:collapse;">${rows}</table>
            </div>
          `,
        }),
      },
    );
  }

  if (isValidEmail(customerEmail)) {
    messages.push(
      {
        type: "customer",
        promise: mailer.sendMail({
          from: `"NexDiff" <${from}>`,
          to: customerEmail,
          subject: `Plan Request Received - ${planName}`,
          text: [
            `Dear ${customerName},`,
            "",
            "Thank you for choosing NexDiff.",
            "",
            `We are pleased to confirm that we have successfully received your request for the ${planName} plan. Our team has recorded the details and will begin processing your request shortly.`,
            "",
            "Request Details",
            "",
            `Plan: ${planName}`,
            `Package: ${packageLabel}`,
            `Amount: ${amount}`,
            "",
            reviewMessage,
            "",
            "Our team will review the submitted information and keep you informed regarding the next steps. If any additional details are required, we will contact you using the information provided in your request.",
            "",
            "Thank you for your interest in NexDiff. We appreciate the opportunity to serve you and look forward to assisting you.",
            "",
            "Best regards,",
            "",
            "Team NexDiff",
            "https://nexdiff.com",
            "",
            "---",
            "",
            "This is an automated confirmation email. Please do not reply directly to this message. If you require assistance, please contact our support team through our website.",
          ].join("\n"),
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;">
              <p>Dear ${escapeHtml(customerName)},</p>
              <p>Thank you for choosing NexDiff.</p>
              <p>We are pleased to confirm that we have successfully received your request for the <strong>${escapeHtml(planName)}</strong> plan. Our team has recorded the details and will begin processing your request shortly.</p>
              <h3 style="margin-top:24px;color:#101312;">Request Details</h3>
              <div style="background:#f8fafc;padding:15px;border-radius:8px;margin:20px 0;">
                <p><strong>Plan:</strong> ${escapeHtml(planName)}</p>
                <p><strong>Package:</strong> ${escapeHtml(packageLabel)}</p>
                <p><strong>Amount:</strong> ${escapeHtml(amount)}</p>
              </div>
              <p>${escapeHtml(reviewMessage)}</p>
              <p>Our team will review the submitted information and keep you informed regarding the next steps. If any additional details are required, we will contact you using the information provided in your request.</p>
              <p>Thank you for your interest in NexDiff. We appreciate the opportunity to serve you and look forward to assisting you.</p>
              <p>Best regards,</p>
              <p><strong>Team NexDiff</strong><br><a href="https://nexdiff.com/" style="color:#2563eb;">https://nexdiff.com</a></p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">
              <p style="font-size:12px;color:#6b7280;"><em>This is an automated confirmation email. Please do not reply directly to this message. If you require assistance, please contact our support team through our website.</em></p>
            </div>
          `,
        }),
      },
    );
  } else {
    console.warn("Plan request customer email skipped: invalid customer email.");
  }

  const results = await Promise.all(
    messages.map((message) =>
      message.promise
        .then((info) => ({
          type: message.type,
          status: "fulfilled",
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
        }))
        .catch((error) => ({
          type: message.type,
          status: "rejected",
          reason: error,
        })),
    ),
  );
  const failed = results.filter((result) => result.status === "rejected");
  const customerResult = results.find((result) => result.type === "customer");

  if (failed.length) {
    console.error("Plan request email failed:", failed.map((result) => result.reason?.message || result.reason));
  }

  return {
    sent: results.length - failed.length,
    failed: failed.length,
    customerSent: customerResult?.status === "fulfilled",
    customerMessageId: customerResult?.messageId,
  };
};

module.exports = {
  sendContactRequestEmails,
  sendCareerApplicationEmails,
  sendPlanRequestEmails,
};
