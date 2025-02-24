"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Email: email, Password: password }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Login successful!");
        Cookies.set('auth-token', data.token, { path: '/', expires: 1 });
        router.push('/profile'); // Redirect to profile page
      } else {
        // Prefer error field, otherwise use message field
        setMessage(data.error || data.message || "Login failed. Please try again.");
      }
    } catch {
        setMessage("An error occurred. Please try again.");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/users/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Email: email }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Password reset link sent to your email.");
      } else {
        setMessage(data.message || "Failed to send password reset link. Please try again.");
      }
    } catch {
       setMessage("An error occurred. Please try again.");
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Email:</label>
          <input
            className="w-full p-2 border border-gray-300 rounded"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Password:</label>
          <input
            className="w-full p-2 border border-gray-300 rounded"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {message && <p className="mt-4 text-center">{message}</p>}
        <button
          type="submit"
          className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
        >
          Login
        </button>
      </form>
      <button
        onClick={handleForgotPassword}
        className="mt-4 text-sm text-gray-600 hover:underline block mx-auto"
      >
        Forgot Password?
      </button>
    </div>
  );
};

export default LoginForm;
