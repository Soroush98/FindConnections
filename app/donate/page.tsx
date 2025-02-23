"use client";
import { useRouter } from "next/navigation";

export default function DonatePage() {
  const router = useRouter();

  // Replace the href URL with your actual payment gateway link.
  const donationLink = "https://www.paypal.com/ncp/payment/YXXLFJ8CKVX5G";

  return (
    <div className="text-black min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <h1 className="text-4xl font-bold mb-6">Donate</h1>
      <p className="mb-6 text-lg text-center">
        If you appreciate our work, please consider donating. You can give any amount you like.
      </p>
      <a
        href={donationLink}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700"
      >
        Donate via PayPal
      </a>
      <button
        onClick={() => router.push("/")}
        className="mt-6 text-blue-500 hover:underline"
      >
        Back to Home
      </button>
    </div>
  );
}
