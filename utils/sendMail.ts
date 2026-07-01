import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter;

const getTransporter = (): nodemailer.Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendMail = async ({ to, subject, html }: MailOptions): Promise<boolean> => {
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
};

export const sendOtpMail = async (to: string, otp: string): Promise<boolean> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #111; text-align: center;">ATHLETICA</h2>
      <p style="color: #555; font-size: 14px;">Your One-Time Password (OTP) for password reset:</p>
      <div style="background: #f5f5f5; padding: 15px; text-align: center; border-radius: 8px; margin: 15px 0;">
        <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #111;">${otp}</span>
      </div>
      <p style="color: #999; font-size: 12px;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
    </div>
  `;

  return sendMail({
    to,
    subject: "ATHLETICA - Password Reset OTP",
    html,
  });
};
