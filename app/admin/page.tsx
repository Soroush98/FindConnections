"use client";
import { useState } from "react";
import Head from 'next/head';

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

      const data = "Invalid email or password";
      setMessage(data || "Login failed. Please try again.");
      
  };

  return (
    <>
    <Head>
      <meta name="robots" content="noindex" />
    </Head>
    <div className="text-sm md:text-base">
      <div className="min-h-screen bg-gradient-to-r from-purple-800 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
            >
              Login
            </button>
            {message && (
              <p className="mt-4 text-center">{message}</p>
            )}
          </form>
        </div>
      </div>
    </div>
    </>
  );
}
