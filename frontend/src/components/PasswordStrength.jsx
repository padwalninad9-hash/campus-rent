import { Check, X } from "lucide-react";

export function getPasswordChecks(password) {
  return [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /\d/.test(password) },
    { label: "One symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function isStrongPassword(password) {
  return getPasswordChecks(password).every((check) => check.met);
}

export default function PasswordStrength({ password }) {
  if (!password) return null;
  const checks = getPasswordChecks(password);
  const score = checks.filter((check) => check.met).length;
  const names = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  const name = names[Math.max(0, score - 1)];

  return <div className="password-strength" aria-live="polite">
    <div className="flex items-center justify-between gap-3"><span>Password strength</span><b className={`strength-${score}`}>{name}</b></div>
    <div className="strength-bars" aria-label={`${name} password`}>
      {[1, 2, 3, 4, 5].map((bar) => <i key={bar} className={bar <= score ? `strength-bar-${score}` : ""} />)}
    </div>
    <ul>{checks.map((check) => <li key={check.label} className={check.met ? "met" : ""}>{check.met ? <Check size={14} /> : <X size={14} />}{check.label}</li>)}</ul>
  </div>;
}
