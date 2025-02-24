"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AWS from "aws-sdk";
import { awsConfig } from "@/config";
import { UserInfo } from "@/types/UserInfo";
import Switch from "@mui/material/Switch";
import Cookies from "js-cookie";
import { useTheme, useMediaQuery } from "@mui/material";
AWS.config.update({
  region: awsConfig.region,
  accessKeyId: awsConfig.accessKeyId,
  secretAccessKey: awsConfig.secretAccessKey,
});
export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    Id: "",
    Name: "",
    FamilyName: "",
    Email: "",
    Password: "",
    confirmationToken: "",
    tokenExpiration: 0,
    isConfirmed: false,
    uploadCount: 0,
    lastUploadDate: "",
    notification_enabled: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [firstPersonFullName, setFirstPersonFullName] = useState("");
  const [secondPersonFullName, setSecondPersonFullName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [changePasswordMessage, setChangePasswordMessage] = useState("");
  const [changePasswordMessageColor, setChangePasswordMessageColor] = useState("red-500");
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"))
  useEffect(() => {
    const loadUserInfo = async () => {

      try {
        setIsLoading(true);
        const token = Cookies.get("auth-token");
        if (!token) {
          router.push("/");
          return;
        }
        const res = await fetch("/api/users/user", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch user info: ${res.statusText}`);
        }
        const data = await res.json();
        if (!data.isConfirmed) {
          router.push(`/register-success?token=${token}`);
          return;
        }

        const today = new Date().toISOString().split("T")[0];
        if (data.lastUploadDate !== today) {
          data.uploadCount = 10;
          await updateUserUploadCount(data.Id, 10, today);
        }

        setUserInfo(data);
        setEmailNotifications(data.notification_enabled === 1);
      } catch (error) {
        console.error("Error loading user profile:", error);
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };
    loadUserInfo();
  }, [router]);

  const updateUserUploadCount = async (userId: string, uploadCount: number, lastUploadDate: string) => {
    const token = Cookies.get("auth-token");
    await fetch("/api/users/update-upload-count", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uploadCount, lastUploadDate }),
    });
  };

  const handleLogout = async () => {
    Cookies.set("auth-token", "");
    await fetch("/api/users/logout", { method: "POST" });
    router.push("/");
  };

  const handleChangePassword = async () => {
    try {
      const token = Cookies.get("auth-token");
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
    } catch  {
      setChangePasswordMessageColor("red-500");
      setChangePasswordMessage("An error occurred. Please try again.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
      if (!allowedTypes.includes(file.type)) {
        alert("Only PNG and JPEG files are allowed.");
        return;
      }
      setSelectedFile(file);
    } else {
      alert("File size should be less than 5 MB.");
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().split("T")[0];
    

    if (!selectedFile) {
      setUploadMessage("Please select a file to upload.");
      return;
    }

    if (!firstPersonFullName.trim() || !secondPersonFullName.trim()) {
      setUploadMessage("Please fill in both textboxes for first person and second person.");
      return;
    }

    const nameRegex = /^[a-zA-Z]+\s[a-zA-Z]+$/;
    if (!nameRegex.test(firstPersonFullName) || !nameRegex.test(secondPersonFullName)) {
      setUploadMessage("Name format is incorrect. Please use '{name} {familyname}' format.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("firstPersonFullName", firstPersonFullName);
      formData.append("secondPersonFullName", secondPersonFullName);
      formData.append("file", selectedFile);

      const token = Cookies.get('auth-token');
      const res = await fetch("/api/users/user-upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
       
       
        const updatedUserInfoRes = await fetch("/api/users/user", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (updatedUserInfoRes.ok) {
          const updatedUserInfo = await updatedUserInfoRes.json();
          setUserInfo(updatedUserInfo);
        }
        const currentUploadCount = userInfo.uploadCount || 0;
        if (userInfo.lastUploadDate === today && currentUploadCount <= 0) {
          setUploadMessage("You have reached the daily upload limit.");
          return;
        }
        const newUploadCount = currentUploadCount - 1;
        setUserInfo((prev) => ({
          ...prev,
          uploadCount: newUploadCount,
          lastUploadDate: today,
        }));
        await updateUserUploadCount(userInfo.Id, newUploadCount, today); // Update the upload count in the database
        setUploadMessage("File uploaded successfully!");
      } else {
        setUploadMessage(data.message || "Failed to upload file. Please try again.");
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadMessage("Failed to upload file. Please try again.");
    }
  };

  const handleNameChange = (
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const nameRegex = /^[a-zA-Z\s]*$/; // Allow alphabetic characters and spaces
    if (nameRegex.test(value)) {
      setter(value);
    } else {
      alert("Only alphabetic characters and spaces are allowed.");
    }
  };

  const handleNotificationChange = async (enabled: boolean) => {
    setEmailNotifications(enabled);
    const token = Cookies.get("auth-token");
    try {
      const res = await fetch("/api/users/set-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

  const handleUploadButtonClick = () => {
    if (!firstPersonFullName.trim() || !secondPersonFullName.trim()) {
      setUploadMessage("Please fill in both textboxes for first person and second person.");
      return;
    }
    if (!selectedFile) {
      setUploadMessage("Please select a file to upload.");
    } else {
      const form = document.createElement('form');
      form.addEventListener('submit', handleUpload as unknown as EventListener);
      const event = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
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
          <input type="email" value={userInfo.Email} disabled className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white" />
          <label className="block md:text-sm font-medium text-gray-300">First Name</label>
          <input type="text" value={userInfo.Name} disabled className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white" />
          <label className="block md:text-sm font-medium text-gray-300">Last Name</label>
          <input type="text" value={userInfo.FamilyName} disabled className="w-full p-2 border rounded-md bg-white/10 text-white" />
        </div>

        {/* Change Password */}
        <form onSubmit={handleUpload} className="border p-4 rounded-lg mb-6 bg-white/20">
          <h3 className="font-semibold sm:text[1.5vw] md:text-xl mb-4 text-white">Change Password</h3>
          <label className="block md:text-sm font-medium text-gray-300">Current Password</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white" />
          <label className="block md:text-sm font-medium text-gray-300">New Password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white" />
          <label className="block md:text-sm font-medium text-gray-300">Confirm New Password</label>
          <input type="password" className="mb-4 w-full p-2 border rounded-md bg-white/10 text-white" />
          <button type="button" onClick={handleChangePassword} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg">Update Password</button>
          {changePasswordMessage && (
            <p className={`mt-4 text-center text-${changePasswordMessageColor}`}>
              {changePasswordMessage}
            </p>
          )}
        </form>

        {/* Upload Rules */}
        <div className="border p-4 rounded-lg mb-6 bg-white/20">
          <h3 className="font-semibold sm:text[1.5vw] md:text-xl mb-4 text-white">Upload Guidelines</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Accepted file formats: PNG, JPG, JPEG.</li>
            <li>Maximum file size: 5 MB.</li>
            <li>Include well-known individuals (e.g., those with verified LinkedIn, GitHub, Instagram profiles).</li>
            <li>Ensure correct spelling (only one accepted spelling per person).</li>
          </ul>
        </div>

        {/* Upload Connection */}
        <form className="border p-4 rounded-lg mb-6 bg-white/20">
          <h3 className="font-semibold sm:text[1.5vw] md:text-xl mb-4 text-white">Upload Connection</h3>
            <label className="block md:text-sm font-medium text-white">First Person&apos;s Full Name</label>
            <input type="text" value={firstPersonFullName} onChange={handleNameChange(setFirstPersonFullName)} className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white" />
            <label className="block md:text-sm font-medium text-white">Second Person&apos;s Full Name</label>
            <input type="text" value={secondPersonFullName} onChange={handleNameChange(setSecondPersonFullName)} className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white" />
          <label className="block md:text-sm font-medium text-gray-300">Connection Picture</label>
          <div
            className="border-dashed border-2 p-4 text-center cursor-pointer mb-4 bg-white/10 text-white"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleFileChange}
              className="hidden"
              ref={fileInputRef}
            />
            {selectedFile ? <p>{selectedFile.name}</p> : <p className="text-gray-300">Upload a file or drag and drop (PNG, JPG, up to 5MB)</p>}
          </div>
          
          <button type="button" onClick={handleUploadButtonClick} className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg">Upload Connection</button>
          {uploadMessage && (
            <p className="mt-4 text-center font-medium text-white">{uploadMessage}</p>
          )}
          <p className="mt-4 text-center text-white">
            Uploads left today: {userInfo.uploadCount}
          </p>
        </form>
          
        {/* Email Notifications */}
        <div className="border p-4 rounded-lg flex items-center justify-between bg-white/20">
          <div>
            <h3 className="font-semibold sm:text[1.5vw] md:text-xl text-white">Email Notifications</h3>
            <p className="text-gray-300">Get notified about updates and activities</p>
          </div>
          <Switch size="small"  sx={{
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
