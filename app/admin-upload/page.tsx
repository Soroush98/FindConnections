"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from 'js-cookie';

export default function AdminUploadPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [uploadMessage, setUploadMessage] = useState("");
  const [firstPersonFullName, setFirstPersonFullName] = useState("");
  const [secondPersonFullName, setSecondPersonFullName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteNodeMessage, setDeleteNodeMessage] = useState("");
  const [nodeFullName, setNodeFullName] = useState("");

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        setIsLoading(true);
        
        const token = Cookies.get('admin-token');
        if (!token) {
          router.push("/admin");
          return;
        }

        const res = await fetch("/api/admin/admin-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });

        if (!res.ok) {
          router.push("/admin");
          return;
        }
        
      } catch {
        router.push("/admin");
      } finally {
        setIsLoading(false);
      }
    };

    loadUserInfo();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        alert("Only PNG and JPEG files are allowed.");
        return;
      }
      setSelectedFile(file);
    } else {
      alert("File size should be less than 5 MB.");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadMessage("Please select a file to upload.");
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

      const token = Cookies.get('admin-token');
      const res = await fetch("/api/admin/admin-upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadMessage("File uploaded and nodes created successfully!");
      } else {
        setUploadMessage(data.message || "Failed to upload file or create nodes. Please try again.");
      }
    } catch (error) {
      console.error('Error uploading file or creating nodes:', error);
      setUploadMessage("Failed to upload file or create nodes. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (!firstPersonFullName.trim() || !secondPersonFullName.trim()) {
      setDeleteMessage("Please fill in both textboxes for first person and second person.");
      return;
    }

    const nameRegex = /^[a-zA-Z]+\s[a-zA-Z]+$/;
    if (!nameRegex.test(firstPersonFullName) || !nameRegex.test(secondPersonFullName)) {
      setDeleteMessage("Name format is incorrect. Please use '{name} {familyname}' format.");
      return;
    }

    try {
      const token = Cookies.get('admin-token');
      const res = await fetch("/api/admin/delete-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ firstPersonFullName, secondPersonFullName }),
      });

      if (res.ok) {
        setDeleteMessage("Connection deleted successfully!");
      } else {
        const data = await res.json();
        setDeleteMessage(data.message || "Failed to delete connection. Please try again.");
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
      setDeleteMessage("Failed to delete connection. Please try again.");
    }
  };

  const handleDeleteNode = async () => {
    if (!nodeFullName.trim()) {
      setDeleteNodeMessage("Please fill in the full name.");
      return;
    }

    const nameRegex = /^[a-zA-Z]+\s[a-zA-Z]+$/;
    if (!nameRegex.test(nodeFullName)) {
      setDeleteNodeMessage("Name format is incorrect. Please use '{name} {familyname}' format.");
      return;
    }

    try {
      const token = Cookies.get('admin-token');
      const res = await fetch("/api/admin/delete-node", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ fullName: nodeFullName }),
      });

      if (res.ok) {
        setDeleteNodeMessage("Node and its connections deleted successfully!");
      } else {
        const data = await res.json();
        setDeleteNodeMessage(data.message || "Failed to delete node. Please try again.");
      }
    } catch (error) {
      console.error('Error deleting node:', error);
      setDeleteNodeMessage("Failed to delete node. Please try again.");
    }
  };

  const handleNameChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const nameRegex = /^[a-zA-Z\s]*$/; // Allow alphabetic characters and spaces
    if (nameRegex.test(value)) {
      setter(value);
    } else {
      alert("Only alphabetic characters and spaces are allowed.");
    }
  };

  const handleLogout = () => {
    Cookies.set('admin-token', '');
    router.push("/admin");
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

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-800 to-blue-900 p-15 flex items-center justify-center text-sm md:text-base">
      <div className="text-[1.2vw] md:w-[40vw] w-[70vw] mx-auto p-6 bg-gradient-to-r from-purple-800 to-blue-900 shadow-lg rounded-lg">
        <h2 className="sm:text-[3vw] md:text-2xl font-semibold mb-4 text-white ">Admin Upload</h2>
        <p className="text-gray-300 mb-6">Upload connections and manage the database</p>

        {/* Upload Rules */}
        <div className="border p-4 rounded-lg mb-6 bg-white/20">
          <h3 className="font-semibold sm:text-[1.5vw] md:text-xl mb-4 text-white">Upload Rules</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Only PNG, JPG and JPEG files are allowed.</li>
            <li>File size should be less than 5 MB.</li>
            <li>Try to use the correct spelling. (Only one spelling is acceptable for each person)</li>
          </ul>
        </div>

        {/* Upload Form */}
        <form className="border p-4 rounded-lg mb-6 bg-white/20">
          <h3 className="font-semibold sm:text-[1.5vw] md:text-xl mb-4 text-white">Upload Connection</h3>
          <label className="block sm:text[1.2vw] md:text-sm font-medium text-gray-300">First Person&apos;s Full Name</label>
          <input type="text" value={firstPersonFullName} onChange={handleNameChange(setFirstPersonFullName)} className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white" />
          <label className="block sm:text[1.2vw] md:text-sm font-medium text-gray-300">Second Person&apos;s Full Name</label>
          <input type="text" value={secondPersonFullName} onChange={handleNameChange(setSecondPersonFullName)} className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white" />

          <label className="block sm:text[1.2vw] md:text-sm font-medium text-gray-300">Connection Picture</label>
          <div
            className="border-dashed border-2 p-4 text-center cursor-pointer mb-4 bg-white/10 text-white"
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input
              type="file"
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleFileChange}
              className="hidden"
              id="fileInput"
            />
            {selectedFile ? <p>{selectedFile.name}</p> : <p className="text-gray-300">Upload a file or drag and drop (PNG, JPG, up to 5MB)</p>}
          </div>
          
          <button type="button" onClick={handleUpload} className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg">Upload Connection</button>
          {uploadMessage && (
            <p className="mt-4 text-center font-medium text-white">{uploadMessage}</p>
          )}
        </form>

        {/* Delete Form */}
        <form className="border p-4 rounded-lg mb-6 bg-white/20">
          <h3 className="font-semibold sm:text[1.5vw] md:text-xl mb-4 text-white">Delete Connection</h3>
          <label className="block sm:text[1.2vw] md:text-sm font-medium text-gray-300">First Person&apos;s Full Name</label>
          <input type="text" value={firstPersonFullName} onChange={handleNameChange(setFirstPersonFullName)} className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white" />
          <label className="block sm:text[1.2vw] md:text-sm font-medium text-gray-300">Second Person&apos;s Full Name</label>
          <input type="text" value={secondPersonFullName} onChange={handleNameChange(setSecondPersonFullName)} className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white" />
          
          <button type="button" onClick={handleDelete} className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg">Delete Connection</button>
          {deleteMessage && (
            <p className="mt-4 text-center font-medium text-white">{deleteMessage}</p>
          )}
        </form>

        {/* Delete Node Form */}
        <form className="border p-4 rounded-lg mb-6 bg-white/20">
          <h3 className="font-semibold sm:text[1.5vw] md:text-xl mb-4 text-white">Delete Node</h3>
          <label className="block sm:text[1.2vw] font-medium text-gray-300">Full Name</label>
          <input type="text" value={nodeFullName} onChange={handleNameChange(setNodeFullName)} className="mb-3 w-full p-2 border rounded-md bg-white/10 text-white" />
          
          <button type="button" onClick={handleDeleteNode} className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg">Delete Node</button>
          {deleteNodeMessage && (
            <p className="mt-4 text-center font-medium text-white">{deleteNodeMessage}</p>
          )}
        </form>

        <div className="text-[1vw] flex justify-between mt-8">
          <button
            onClick={() => router.push("/")}
            className="bg-purple-600 hover:bg-purple-700 text-white w-[15vw] h-[3vw]  rounded-lg transition-all"
          >
            Back to Home
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white w-[10vw] h-[3vw]  rounded-lg transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
