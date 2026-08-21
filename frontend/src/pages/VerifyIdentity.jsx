import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, CircleAlert, FileBadge, ImageUp, LoaderCircle, LockKeyhole, ScanFace, ShieldCheck, UserRoundCheck, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function VerifyIdentity() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [identityDocument, setIdentityDocument] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [faceStatus, setFaceStatus] = useState("starting");
  const detectionTimerRef = useRef(null);

  useEffect(() => {
    async function loadStatus() {
      const { data } = await supabase.from("kyc_submissions").select("status, review_note").eq("user_id", user.id).maybeSingle();
      setStatus(data?.status || "not_started");
    }
    if (user) loadStatus();
  }, [user]);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    if (detectionTimerRef.current) window.clearInterval(detectionTimerRef.current);
    detectionTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    setCameraError(""); setFaceStatus("starting");
    if (!navigator.mediaDevices?.getUserMedia) return setCameraError("Your browser does not support camera access. Please use a modern browser.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        // FaceDetector is a privacy-friendly browser API: frames never leave
        // the device. Unsupported browsers retain the live-selfie fallback.
        if (!("FaceDetector" in window)) return setFaceStatus("unsupported");
        const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
        detectionTimerRef.current = window.setInterval(async () => {
          try {
            const faces = await detector.detect(videoRef.current);
            setFaceStatus(faces.length === 1 ? "ready" : faces.length > 1 ? "multiple" : "not_found");
          } catch { setFaceStatus("unsupported"); }
        }, 700);
      }, 0);
    } catch {
      setCameraError("Camera access was blocked. Allow camera permission in your browser settings, then try again.");
    }
  }

  function closeCamera() { stopCamera(); setCameraOpen(false); }

  function takeSelfie() {
    const video = videoRef.current;
    if (!video?.videoWidth) return setCameraError("Your camera is still starting. Please wait a moment and try again.");
    if (faceStatus === "multiple") return setCameraError("Only one person should be visible in the camera frame.");
    if (faceStatus === "not_found") return setCameraError("We can’t see a face yet. Move into good lighting and center your face in the guide.");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return setCameraError("We couldn't capture the photo. Please try again.");
      setSelfie(new File([blob], `rentify-selfie-${Date.now()}.jpg`, { type: "image/jpeg" }));
      closeCamera();
    }, "image/jpeg", 0.9);
  }

  function validateFile(file, label) {
    if (!file) return `${label} is required.`;
    if (!file.type.startsWith("image/")) return `${label} must be an image.`;
    if (file.size > MAX_FILE_SIZE) return `${label} must be smaller than 5 MB.`;
    return "";
  }

  async function submit(event) {
    event.preventDefault();
    const fileError = validateFile(identityDocument, "Identity document") || validateFile(selfie, "Selfie");
    if (fileError) return setError(fileError);
    if (!consent) return setError("Please give consent before submitting your documents.");
    setError(""); setStatus("uploading");
    try {
      const timestamp = Date.now();
      const idPath = `${user.id}/${timestamp}-identity-document.${identityDocument.name.split(".").pop() || "jpg"}`;
      const selfiePath = `${user.id}/${timestamp}-selfie.jpg`;
      const { error: idUploadError } = await supabase.storage.from("kyc-documents").upload(idPath, identityDocument, { contentType: identityDocument.type });
      if (idUploadError) throw idUploadError;
      const { error: selfieUploadError } = await supabase.storage.from("kyc-documents").upload(selfiePath, selfie, { contentType: selfie.type });
      if (selfieUploadError) throw selfieUploadError;
      const { error: submissionError } = await supabase.from("kyc_submissions").insert({ user_id: user.id, identity_document_path: idPath, selfie_path: selfiePath, status: "pending", consent_given_at: new Date().toISOString() });
      if (submissionError) throw submissionError;
      setStatus("pending");
    } catch (submissionError) { setError(submissionError.message || "We couldn't submit your documents. Please try again."); setStatus("not_started"); }
  }

  if (status === "loading") return <div className="py-24 text-center text-sm font-medium text-slate-500">Loading your verification…</div>;
  if (status === "verified") return <div className="kyc-page"><div className="kyc-success"><CheckCircle2 size={44} /><p className="section-kicker">Verification complete</p><h1>You’re a verified Rentify member.</h1><p>Your profile is fully authenticated. You can now access all verification-required features.</p></div></div>;
  if (status === "pending" || status === "uploading") return <div className="kyc-page"><div className="kyc-success"><LoaderCircle size={44} className={status === "uploading" ? "animate-spin" : ""} /><p className="section-kicker">{status === "uploading" ? "Securely uploading" : "Verification in review"}</p><h1>{status === "uploading" ? "Submitting your documents…" : "Thanks — we’re checking your documents."}</h1><p>{status === "uploading" ? "Please keep this page open for a moment." : "We’ll review your photo ID and selfie. Your profile will update once approved."}</p></div></div>;

  return <section className="kyc-page"><div className="kyc-layout"><aside className="kyc-info"><div className="kyc-icon"><ShieldCheck size={30} /></div><p className="section-kicker mt-6 !text-indigo-200">Profile authentication</p><h1>Finish your profile with confidence.</h1><p>Verified accounts help keep Rentify safe and trustworthy for every renter and owner.</p><div className="kyc-steps"><span className="done"><i>✓</i> Account created</span><span className="done"><i>✓</i> Email confirmed</span><span className="current"><i>3</i> Identity verification</span></div><div className="kyc-privacy"><LockKeyhole size={17} /> Your documents are encrypted in private storage and are never visible to other users.</div></aside>
    <main className="kyc-card"><div className="flex items-center justify-between"><div><p className="section-kicker">40% remaining</p><h2>Verify your identity</h2></div><span className="kyc-progress-label">60% done</span></div><div className="kyc-progress"><i /></div><p className="mt-4 text-sm leading-6 text-slate-500">Upload a clear photo of a valid government-issued photo ID and take a live selfie. We use them only to confirm your identity.</p>
      <form onSubmit={submit} className="mt-7 space-y-5"><label className="kyc-upload"><input type="file" accept="image/*" onChange={(event) => setIdentityDocument(event.target.files?.[0] || null)} /><span className="kyc-upload-icon"><FileBadge size={22} /></span><span><b>{identityDocument ? identityDocument.name : "Upload a photo ID"}</b><small>JPG, PNG, or WEBP • max 5 MB</small></span><ImageUp size={19} /></label><button type="button" onClick={openCamera} className="kyc-upload kyc-face-upload w-full text-left"><span className="kyc-upload-icon"><ScanFace size={22} /></span><span className="min-w-0 flex-1"><b>{selfie ? "Face check completed" : "Take a face-verified selfie"}</b><small>{selfie ? selfie.name : "Camera checks for one clear face before capture"}</small></span>{selfie ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Camera size={19} />}</button>{cameraError && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{cameraError}</p>}<label className="kyc-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I consent to Rentify securely processing these documents solely for profile verification.</span></label>{error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</p>}<button className="btn-primary w-full py-3.5" disabled={status === "uploading"}>{status === "uploading" ? "Submitting securely…" : "Submit for verification"}</button></form>
    </main></div>
    {cameraOpen && <div className="camera-modal" role="dialog" aria-modal="true" aria-label="Face verification camera"><div className="camera-card face-camera-card"><button type="button" className="camera-close" onClick={closeCamera} aria-label="Close camera"><X size={20} /></button><p className="section-kicker">Live face check</p><h2>Center your face in the frame</h2><p>Use good lighting, remove sunglasses, and look directly at the camera.</p><div className="camera-preview"><video ref={videoRef} autoPlay muted playsInline /><div className="camera-oval" /><span className={`face-scan-line ${faceStatus === "ready" ? "is-ready" : ""}`} /></div><div className={`face-status ${faceStatus}`}><span>{faceStatus === "ready" ? <CheckCircle2 size={17} /> : faceStatus === "multiple" || faceStatus === "not_found" ? <CircleAlert size={17} /> : <ScanFace size={17} />}</span><p>{faceStatus === "ready" ? "One face detected — ready to capture" : faceStatus === "multiple" ? "More than one face detected — only you should be in frame" : faceStatus === "not_found" ? "Move into the guide so we can detect your face" : faceStatus === "unsupported" ? "Camera ready — capture a clear, front-facing selfie" : "Checking your camera for a clear face…"}</p></div>{cameraError && <p className="mt-4 text-sm font-medium text-rose-600">{cameraError}</p>}<button type="button" onClick={takeSelfie} className="btn-primary mt-6 w-full" disabled={faceStatus === "starting"}><Camera size={18} /> {faceStatus === "starting" ? "Preparing camera…" : "Capture verified selfie"}</button><p className="face-privacy"><LockKeyhole size={14} /> Face detection happens on this device. The camera preview is not streamed to Rentify.</p></div></div>}
  </section>;
}
