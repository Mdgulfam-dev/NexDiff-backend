const dns = require("dns");
const nodemailer = require("nodemailer");

dns.setDefaultResultOrder("ipv4first");

let transporter;

const getMailFrom = () =>
  process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

const isEmailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && getMailFrom());

const shouldSendInternalNotifications = () =>
  String(process.env.SEND_INTERNAL_NOTIFY_EMAILS || "true").toLowerCase() !== "false";

// const getTransporter = () => {
//   if (transporter) {
//     return transporter;
//   }

//   const auth =
//     process.env.SMTP_USER && process.env.SMTP_PASS
//       ? {
//           user: process.env.SMTP_USER,
//           pass: process.env.SMTP_PASS,
//         }
//       : undefined;

//   // transporter = nodemailer.createTransport({
//   //   host: process.env.SMTP_HOST,
//   //   port: Number(process.env.SMTP_PORT),
//   //   secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
//   //   family: Number(process.env.SMTP_FAMILY || 4),
//   //   auth,
//   // });

//   transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: Number(process.env.SMTP_PORT),
//     secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
//     auth,

//     lookup(hostname, options, callback) {
//       return dns.lookup(hostname, { family: 4 }, callback);
//     },
//   });

//   return transporter;
// };

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
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",

    auth,

    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,

    // Force IPv4 on Render
    lookup(hostname, options, callback) {
      return dns.lookup(hostname, { family: 4 }, callback);
    },
  });

  transporter.verify((error, success) => {
    if (error) {
      console.error("SMTP VERIFY ERROR:", error);
    } else {
      console.log("SMTP READY");
    }
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

const statusLabels = {
  new: "New",
  reviewed: "Reviewed",
  discussion: "Discussion",
  followup: "Follow Up",
  proposal_sent: "Proposal Sent",
  payment_pending: "Payment Pending",
  payment_received: "Payment Received",
  in_progress: "In Progress",
  selected: "Selected",
  completed: "Completed",
  closed: "Closed",
  rejected: "Rejected",
};

const submissionTypeLabels = {
  contact: "project inquiry",
  career: "job application",
  pricing: "plan request",
};

const getStatusLabel = (status) => statusLabels[status] || status;

const getSubmissionSubject = (type, data) => {
  if (type === "career") {
    return data.role || data.jobId || "your application";
  }

  if (type === "pricing") {
    return data.planName || data.packageLabel || "your plan request";
  }

  return data.service || "your project inquiry";
};

const getStatusMessage = (type, status, subject) => {
  if (status === "selected") {
    return type === "career"
      ? `We are pleased to let you know that your application for ${subject} has been shortlisted for the next stage. Our team will contact you with the next steps and any additional details required.`
      : `We are pleased to let you know that your ${submissionTypeLabels[type] || "request"} for ${subject} has been selected for the next stage. Our team will contact you shortly to move this forward.`;
  }

  if (status === "rejected") {
    return type === "career"
      ? `Thank you for the time and effort you invested in applying for ${subject}. After careful review, we are unable to move forward with your application for this requirement. We appreciate your interest in NexDiff and wish you success in your next opportunity.`
      : `Thank you for sharing your requirement with NexDiff. After reviewing the details, we are unable to proceed with ${subject} at this time. We appreciate your interest and hope to support you on a future requirement.`;
  }

  if (status === "completed") {
    return `We have marked ${subject} as completed. Thank you for trusting NexDiff. We appreciate the opportunity to work with you.`;
  }

  if (status === "payment_pending") {
    return `Your request for ${subject} is now at the payment pending stage. Our team will share the required payment details or confirmation steps separately, if applicable.`;
  }

  if (status === "payment_received") {
    return `We have updated your request for ${subject} to payment received. Our team will now continue with the next steps as planned.`;
  }

  if (status === "proposal_sent") {
    return `We have prepared and shared the proposal for ${subject}. Please review it at your convenience, and our team will be available to clarify any scope, timeline, or pricing details.`;
  }

  if (status === "discussion") {
    return `Your request for ${subject} has moved to the discussion stage. Our team will connect with you to better understand your goals, priorities, and expected timeline.`;
  }

  if (status === "followup") {
    return `We have scheduled your request for follow-up. Our team will reconnect with you to continue the conversation and help close any pending details.`;
  }

  if (status === "in_progress") {
    return `Your request for ${subject} is now in progress. Our team has started working through the next steps and will keep you informed as things move ahead.`;
  }

  if (status === "reviewed") {
    return `Our team has reviewed your request for ${subject}. We will contact you if we need any additional information before moving to the next step.`;
  }

  return `Your request for ${subject} has been updated to ${getStatusLabel(status)}. We will share the next relevant update once there is progress or action required from your side.`;
};

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
        subject: `Project Brief Received: ${service} - NexDiff`,
        text: [
          `Dear ${customerName},`,
          "",
          "Thank you for reaching out to NexDiff.",
          "",
          `We have received your project brief for ${service}. Our team will review your requirements, understand the best-fit approach, and contact you with the next steps.`,
          "",
          "What happens next:",
          "1. We review your submitted details.",
          "2. We identify the right service direction and possible scope.",
          "3. A NexDiff team member contacts you to discuss timeline, budget, and execution plan.",
          "",
          "Brief Summary:",
          `Service: ${service}`,
          `Budget: ${request.budget || "Not specified"}`,
          `Urgency: ${request.urgency || "Not specified"}`,
          `Message: ${request.message || "Not specified"}`,
          "",
          "Best regards,",
          "Team NexDiff",
          "https://nexdiff.com",
        ].join("\n"),
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;">
            <p>Dear ${escapeHtml(customerName)},</p>
            <p>Thank you for reaching out to <strong>NexDiff</strong>.</p>
            <p>We have received your project brief for <strong>${escapeHtml(service)}</strong>. Our team will review your requirements, understand the best-fit approach, and contact you with the next steps.</p>
            <p><strong>What happens next:</strong></p>
            <ol style="padding-left:20px;margin-top:8px;">
              <li>We review your submitted details.</li>
              <li>We identify the right service direction and possible scope.</li>
              <li>A NexDiff team member contacts you to discuss timeline, budget, and execution plan.</li>
            </ol>
            <div style="background:#f8fafc;padding:15px;border-radius:8px;margin:20px 0;">
              <h3 style="margin-top:0;color:#101312;">Brief Summary</h3>
              <p><strong>Service:</strong> ${escapeHtml(service)}</p>
              <p><strong>Budget:</strong> ${escapeHtml(request.budget || "Not specified")}</p>
              <p><strong>Urgency:</strong> ${escapeHtml(request.urgency || "Not specified")}</p>
              <p><strong>Message:</strong> ${escapeHtml(request.message || "Not specified")}</p>
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

const sendSubmissionStatusEmail = async ({ type, data, status }) => {
  if (!isEmailConfigured()) {
    console.warn("Status update email skipped: SMTP_HOST, SMTP_PORT, and MAIL_FROM/SMTP_USER are required.");
    return { skipped: true };
  }

  const submissionData = data || {};
  const customerEmail = String(submissionData.email || "").trim();

  if (!isValidEmail(customerEmail)) {
    console.warn("Status update email skipped: invalid customer email.");
    return { skipped: true, customerSent: false };
  }

  const mailer = getTransporter();
  const from = getMailFrom();
  const customerName = submissionData.name || "Customer";
  const subject = getSubmissionSubject(type, submissionData);
  const statusLabel = getStatusLabel(status);
  const typeLabel = submissionTypeLabels[type] || "request";
  const message = getStatusMessage(type, status, subject);

  const info = await mailer.sendMail({
    from: `"NexDiff" <${from}>`,
    to: customerEmail,
    subject: `NexDiff Update: ${statusLabel} - ${subject}`,
    text: [
      `Dear ${customerName},`,
      "",
      message,
      "",
      "Update Summary:",
      `Request Type: ${typeLabel}`,
      `Reference: ${subject}`,
      `Current Status: ${statusLabel}`,
      "",
      "You do not need to take any action unless our team has requested additional information. We will contact you directly if anything else is required.",
      "",
      "Best regards,",
      "Team NexDiff",
      "https://nexdiff.com",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;">
        <p>Dear ${escapeHtml(customerName)},</p>
        <p>${escapeHtml(message)}</p>
        <div style="background:#f8fafc;padding:15px;border-radius:8px;margin:20px 0;">
          <h3 style="margin-top:0;color:#101312;">Update Summary</h3>
          <p><strong>Request Type:</strong> ${escapeHtml(typeLabel)}</p>
          <p><strong>Reference:</strong> ${escapeHtml(subject)}</p>
          <p><strong>Current Status:</strong> ${escapeHtml(statusLabel)}</p>
        </div>
        <p>You do not need to take any action unless our team has requested additional information. We will contact you directly if anything else is required.</p>
        <p>Best regards,<br><strong>Team NexDiff</strong><br><a href="https://nexdiff.com/" style="color:#2563eb;">https://nexdiff.com</a></p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">
        <p style="font-size:12px;color:#6b7280;"><em>This is an automated status update email. Please do not reply directly to this message.</em></p>
      </div>
    `,
  });

  return {
    sent: 1,
    failed: 0,
    customerSent: true,
    customerMessageId: info.messageId,
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
        subject: `Application Received: ${role} - NexDiff Careers`,
        text: [
          `Dear ${applicantName},`,
          "",
          "Thank you for applying to NexDiff.",
          "",
          `We have received your application for the ${role} position. Our hiring team will review your profile against the role requirements and current project needs.`,
          "",
          "If your profile matches the next stage, we will contact you with interview details or any additional information required. If there is not a fit for this opening, we will still keep your application available for relevant future opportunities.",
          "",
          "Application Summary:",
          `Role: ${role}`,
          `Job ID: ${application.jobId || "N/A"}`,
          `Experience: ${application.experience || "Not specified"}`,
          "",
          "We appreciate your interest in building with NexDiff.",
          "",
          "Best regards,",
          "NexDiff Talent Acquisition Team",
          "https://nexdiff.com",
        ].join("\n"),
        html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;">
        <h2 style="color:#2563eb;">Application Received</h2>

        <p>Dear ${escapeHtml(applicantName)},</p>

        <p>
          Thank you for applying to <strong>NexDiff</strong>. We have received your
          application for the <strong>${escapeHtml(role)}</strong> position.
        </p>

        <p>
          Our hiring team will review your profile against the role requirements
          and current project needs. If your profile matches the next stage, we
          will contact you with interview details or any additional information
          required.
        </p>

        <div style="background:#f8fafc;padding:15px;border-radius:8px;margin:20px 0;">
          <h3 style="margin-top:0;">Application Summary</h3>
          <p><strong>Role:</strong> ${escapeHtml(role)}</p>
          <p><strong>Job ID:</strong> ${escapeHtml(application.jobId || "N/A")}</p>
          <p><strong>Experience:</strong> ${escapeHtml(application.experience || "Not specified")}</p>
        </div>

        <p>
          We appreciate your interest in building with NexDiff.
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
    ? "No payment proof is required for this request. Our team will review your details and confirm the next steps."
    : "Our team will verify the submitted payment proof and request details before confirming the next steps.";

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
          subject: `Plan Request Received: ${planName} - NexDiff`,
          text: [
            `Dear ${customerName},`,
            "",
            "Thank you for choosing NexDiff.",
            "",
            `We have received your request for the ${planName} plan. Our team will review your submitted details, confirm the package requirements, and contact you with the next steps.`,
            "",
            "Request Details",
            "",
            `Plan: ${planName}`,
            `Package: ${packageLabel}`,
            `Amount: ${amount}`,
            "",
            reviewMessage,
            "",
            "If we need clarification about your business, platforms, content requirements, or payment proof, we will contact you using the details submitted in your request.",
            "",
            "We appreciate the opportunity to support your growth.",
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
              <p>We have received your request for the <strong>${escapeHtml(planName)}</strong> plan. Our team will review your submitted details, confirm the package requirements, and contact you with the next steps.</p>
              <h3 style="margin-top:24px;color:#101312;">Request Details</h3>
              <div style="background:#f8fafc;padding:15px;border-radius:8px;margin:20px 0;">
                <p><strong>Plan:</strong> ${escapeHtml(planName)}</p>
                <p><strong>Package:</strong> ${escapeHtml(packageLabel)}</p>
                <p><strong>Amount:</strong> ${escapeHtml(amount)}</p>
              </div>
              <p>${escapeHtml(reviewMessage)}</p>
              <p>If we need clarification about your business, platforms, content requirements, or payment proof, we will contact you using the details submitted in your request.</p>
              <p>We appreciate the opportunity to support your growth.</p>
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
  sendSubmissionStatusEmail,
  sendCareerApplicationEmails,
  sendPlanRequestEmails,
};
