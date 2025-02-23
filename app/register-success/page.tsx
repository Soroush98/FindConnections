"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RegisterSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (searchParams) {
      const emailParam = searchParams.get("email");
      if (emailParam) {
        setEmail(emailParam);
      } else {
        router.push("/");
      }
    } else {
      router.push("/");
    }
  }, [searchParams, router]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleLogout = async () => {
    await fetch("/api/users/logout", {
      method: "POST"
    });
    router.push("/");
  };

  const handleResendConfirmation = async () => {
    setCountdown(60);
    try {
      const res = await fetch("/api/users/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Email: email }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage("Confirmation email resent. Please check your email.");
      } else {
        setMessage(data.message || "Failed to resend confirmation email. Please try again.");
      }
    } catch {
      setMessage("An error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-300 to-blue-500 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold mb-6">Registration Successful</h1>
        <p className="mb-4">You have successfully registered. Please check your email to confirm your account.</p>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Logout
        </button>
        <div className="mt-4">
          <button
            onClick={handleResendConfirmation}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            disabled={countdown > 0}
          >
            {countdown > 0 ? `Resend Confirmation Link (${countdown}s)` : "Resend Confirmation Link"}
          </button>
          {message && <p className="mt-4 text-center">{message}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="text-sm md:text-base">
        <RegisterSuccessPage />
      </div>
    </Suspense>
  );
}
