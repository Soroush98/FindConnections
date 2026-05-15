"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserInfo } from "@/types/UserInfo";
import Switch from "@mui/material/Switch";
import Cookies from "js-cookie";
import { useTheme, useMediaQuery } from "@mui/material";

export default function ProfilePage() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo>({
    Id: "",
    Name: "",
    FamilyName: "",
    Email: "",
    Password: "",
    confirmationToken: "",
    tokenExpiration: 0,
    isConfirmed: false,
    notification_enabled: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [changePasswordMessage, setChangePasswordMessage] = useState("");
  const [changePasswordMessageColor, setChangePasswordMessageColor] = useState("red-500");
  const [csrfToken, setCsrfToken] = useState("");
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/users/verify-user", {});
        if (!res.ok) {
          throw new Error(`Failed to fetch user info: ${res.statusText}`);
        }
        const data = await res.json();
        if (!data.isConfirmed) {
          const token = Cookies.get("auth-token");
          router.push(`/register-success?token=${token}`);
          return;
        }

        setUserInfo(data);
        setEmailNotifications(data.notification_enabled === 1);
      } catch {
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };
    loadUserInfo();
  }, [router]);

  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const res = await fetch("/api/users/csrf-token");
        if (res.ok) {
          const data = await res.json();
          setCsrfToken(data.csrfToken);
        }
      } catch (error) {
        console.error("Error fetching CSRF token:", error);
      }
    };

    fetchCsrfToken();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/users/logout", { method: "POST" });
    router.push("/");
  };

  const handleChangePassword = async () => {
    try {
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "include", // Include credentials such as cookies
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setChangePasswordMessageColor("green-500");
        setChangePasswordMessage("Password changed successfully!");
      } else if (res.status === 401) {
        setChangePasswordMessageColor("red-500");
        setChangePasswordMessage("Password is incorrect. Please try again.");
      } else {
        setChangePasswordMessageColor("red-500");
        const data = await res.json();
        setChangePasswordMessage(data.message || "Failed to change password. Please try again.");
      }
    } catch {
      setChangePasswordMessageColor("red-500");
      setChangePasswordMessage("An error occurred. Please try again.");
    }
  };

  const handleNotificationChange = async (enabled: boolean) => {
    setEmailNotifications(enabled);
    try {
      const res = await fetch("/api/users/set-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        throw new Error("Failed to update notification preference");
      }
    } catch (error) {
      console.error("Error updating notification preference:", error);
      alert("Failed to update notification preference. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-200 to-blue-400">
        <div className="bg-white/20 backdrop-blur-lg rounded-3xl shadow-2xl p-12 text-2xl font-bold text-white">
          Loading...
        </div>
      </div>
    );
  }

  if (!userInfo.isConfirmed) {
    console.log("Email not confirmed, redirecting to register-success page");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-800 to-blue-900 p-15 flex items-center justify-center">
      <div className="text-[1.2vw] md:w-[40vw] w-[70vw] mx-auto p-6 bg-gradient-to-r from-purple-800 to-blue-900 shadow-lg rounded-lg">
        <h2 className="text-[2vw] md:text-2xl font-semibold mb-4 text-white">Account Settings</h2>
        <p className="text-gray-300 mb-6">Manage your account settings and preferences</p>

        {/* Personal Information */}
        <div className="border p-4 rounded-lg mb-6 bg-white/20">
          <h3 className="font-semibold sm:text[1.5vw] md:text-xl mb-4 text-white">Personal Information</h3>
          <label className="block  md:text-sm font-medium text-gray-300">Email</label>
          <input
            type="email"
            value={userInfo.Email}
            disabled
            className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white"
          />
          <label className="block md:text-sm font-medium text-gray-300">First Name</label>
          <input
            type="text"
            value={userInfo.Name}
            disabled
            className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white"
          />
          <label className="block md:text-sm font-medium text-gray-300">Last Name</label>
          <input
            type="text"
            value={userInfo.FamilyName}
            disabled
            className="w-full p-2 border rounded-md bg-white/10 text-white"
          />
        </div>

        {/* Change Password */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleChangePassword();
          }}
          className="border p-4 rounded-lg mb-6 bg-white/20"
        >
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <h3 className="font-semibold sm:text[1.5vw] md:text-xl mb-4 text-white">Change Password</h3>
          <label className="block md:text-sm font-medium text-gray-300">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white"
          />
          <label className="block md:text-sm font-medium text-gray-300">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white"
          />
          <label className="block md:text-sm font-medium text-gray-300">Confirm New Password</label>
          <input type="password" className="mb-4 w-full p-2 border rounded-md bg-white/10 text-white" />
          <button
            type="button"
            onClick={handleChangePassword}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg"
          >
            Update Password
          </button>
          {changePasswordMessage && (
            <p className={`mt-4 text-center text-${changePasswordMessageColor}`}>{changePasswordMessage}</p>
          )}
        </form>

        {/* Email Notifications */}
        <div className="border p-4 rounded-lg flex items-center justify-between bg-white/20">
          <div>
            <h3 className="font-semibold sm:text[1.5vw] md:text-xl text-white">Email Notifications</h3>
            <p className="text-gray-300">Get notified about updates and activities</p>
          </div>
          <Switch
            size="small"
            sx={{
              "& .MuiSwitch-thumb": {
                width: isSmallScreen ? 14 : 18,
                height: isSmallScreen ? 14 : 18,
              },
              "& .MuiSwitch-track": {
                height: isSmallScreen ? 10 : 15,
                width: isSmallScreen ? 22 : 35,
              },
            }}
            checked={emailNotifications}
            onChange={(e) => handleNotificationChange(e.target.checked)}
          />
        </div>

        <div className="text-[1.2vw] flex justify-between mt-8">
          <button
            onClick={() => router.push("/")}
            className=" bg-purple-600 hover:bg-purple-700 text-white  w-[15vw] h-[3vw]  rounded-lg transition-all"
          >
            Back to Home
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white  w-[10vw] h-[3vw]  rounded-lg transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
