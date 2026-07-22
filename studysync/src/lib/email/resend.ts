import { Resend } from "resend";

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function emailFrom() {
  return process.env.EMAIL_FROM || "StudySync <onboarding@resend.dev>";
}
