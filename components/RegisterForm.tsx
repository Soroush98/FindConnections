"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const RegisterForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [name, setRegisterName] = useState('');
  const [familyname, setRegisterFamilyName] = useState('');
  const router = useRouter();

  const isStrongPassword = (pass: string) => {
    const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return pattern.test(pass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    if (!isStrongPassword(password)) {
      setMessage("Password is too weak. Requires uppercase, lowercase, digit, and length ≥ 8.");
      return;
    }
    try {
      const res = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Name: name,
          FamilyName: familyname,
          Email: email,
          Password: password,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage("Registration successful! Please check your email to confirm your account.");
        router.push(`/register-success?token=${data.token}`); // Redirect to register success page after successful registration
      } else if (data.message && data.message.includes("Email already exists")) {
        setMessage("Email already exists. Please use a different email.");
      } else {
        setMessage(data.message || "Registration failed. Please try again.");
      }
    } catch {
        setMessage("An error occurred. Please try again.");
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Name:</label>
          <input
            className="w-full p-2 border border-gray-300 rounded"
            type="text"
            value={name}
            onChange={(e) => setRegisterName(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Family Name:</label>
          <input
            className="w-full p-2 border border-gray-300 rounded"
            type="text"
            value={familyname}
            onChange={(e) => setRegisterFamilyName(e.target.value)}
            required
          />
        </div>
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
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Confirm Password:</label>
          <input
            className="w-full p-2 border border-gray-300 rounded"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        {message && <p className="mt-4 text-center">{message}</p>}
        <button
          type="submit"
          className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
        >
          Register
        </button>
      </form>
    </div>
  );
};

export default RegisterForm;
