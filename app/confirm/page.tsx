"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";


function ConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("");
  useEffect(() => {
    const confirmEmail = async (token: string) => {
      try {
        const res = await fetch("/api/users/confirmByToken", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error || "Invalid or expired token.");
          return;
        }
        setMessage("Email confirmed successfully!");
        router.push("/");
      } catch (error) {
        console.error('Error confirming email:', error);
        setMessage("Failed to confirm email. Please try again.");
      }
    };

    if (searchParams) {
      const tokenParam = searchParams.get("token");
      if (tokenParam) {
        confirmEmail(tokenParam);
      } else {
        setMessage("Invalid or expired token.");
      }
    } else {
      setMessage("Invalid or expired token.");
    }
  }, [searchParams, router]);

  const resendConfirmationEmail = async (token: string) => {
    try {
      const res = await fetch("/api/users/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
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
    <div className="min-h-screen bg-gradient-to-r from-blue-300 to-blue-500 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Email Confirmation</h1>
        <p className="mb-4">{message}</p>
        {message.includes("expired") && (
          <button
            onClick={() => {
              if (searchParams) {
                resendConfirmationEmail(searchParams.get("token") || "");
              } else {
                setMessage("Invalid or expired token.");
              }
            }}
            className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
          >
            Resend Confirmation Email
          </button>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="text-sm md:text-base">
        <ConfirmPage />
      </div>
    </Suspense>
  );
}

