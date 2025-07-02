"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDonate } from '@fortawesome/free-solid-svg-icons';
import PersonSelector from "../components/PersonSelector"
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';

export default function HomePage() {
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [showMainPics] = useState(true);
  const [mainPics, setMainPics] = useState<string[]>([]);
  const [suggestions1, setSuggestions1] = useState<string[]>([]);
  const [suggestions2, setSuggestions2] = useState<string[]>([]);
  const [, setLoadingSuggestions1] = useState(false);
  const [, setLoadingSuggestions2] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [hasSelectedSuggestion1, setHasSelectedSuggestion1] = useState(false);
  const [hasSelectedSuggestion2, setHasSelectedSuggestion2] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const router = useRouter();

  // Set two random main pictures
  useEffect(() => {
    const picList = [
      "MohammadReza Golzar_Actor.jpg",
      "Johnny Depp_Actor.jpg",
      "Brad Pitt_Actor.jpg",
      "Britt Lower_Actress.jpg",
      "Margot Robbie_Actress.jpg",
      "Elahe Hesari_Actress.jpg",
      "Ebrahim Hamedi_Singer.jpg",
      "Travis Scott_Singer.jpg",
      "Taraneh Alidousti_Actress.jpg",
    ];
    // Shuffle and pick first two
    const shuffled = picList.sort(() => 0.5 - Math.random());
    setMainPics(shuffled.slice(0, 2));
  }, []);


  useEffect(() => {
    async function fetchSuggestions() {
      if (name1.length < 2 || hasSelectedSuggestion1) {
        setSuggestions1([]);
        setLoadingSuggestions1(false);
        return;
      }
      
      setLoadingSuggestions1(true);
      try {
        // always fetch from API
        const res = await fetch(`/api/general/suggestions?query=`);
        const data = await res.json();
        const allNames: string[] = data.suggestions || [];
        const lowerQuery = name1.toLowerCase();
        const filtered = allNames.filter(n => n.toLowerCase().includes(lowerQuery));
        setSuggestions1(filtered.slice(0, 3)); // Limit to 3 suggestions
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions1([]);
      } finally {
        setLoadingSuggestions1(false);
      }
    }
    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [name1, hasSelectedSuggestion1]);

  useEffect(() => {
    async function fetchSuggestions() {
      if (name2.length < 2 || hasSelectedSuggestion2) {
        setSuggestions2([]);
        setLoadingSuggestions2(false);
        return;
      }
      
      setLoadingSuggestions2(true);
      try {
        //always fetch from API
        const res = await fetch(`/api/general/suggestions?query=`);
        const data = await res.json();
        const allNames: string[] = data.suggestions || [];
        const lowerQuery = name2.toLowerCase();
        const filtered = allNames.filter(n => n.toLowerCase().includes(lowerQuery));
        setSuggestions2(filtered.slice(0, 3)); // Limit to 3 suggestions
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions2([]);
      } finally {
        setLoadingSuggestions2(false);
      }
    }
    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [name2, hasSelectedSuggestion2]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name1.trim() || !name2.trim()) {
      setConnectionError("Please type something in both text boxes");
      return;
    }
    // New check for equal names
    if (name1.trim().toLowerCase() === name2.trim().toLowerCase()) {
      setConnectionError("Names cannot be equal");
      return;
    }
    setConnectionError("");
    
    // Navigate to connections page with query parameters
    router.push(`/connections?name1=${encodeURIComponent(name1.trim())}&name2=${encodeURIComponent(name2.trim())}`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadError("");
      setUploadMessage("");
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError("Please select a file first");
      return;
    }

    setUploadLoading(true);
    setUploadError("");
    setUploadMessage("");

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch('/api/general/upload-temp', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadMessage(data.message);
        setUploadFile(null);
        // Reset file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setUploadError(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen w-full overflow-x-auto bg-gradient-to-r from-purple-800 to-blue-900 flex flex-col items-center justify-center p-4">
        <div className=" absolute top-4 right-4 flex space-x-4">
              <a
              href="#"
              onClick={() => setShowHowItWorks(true)}
              className="text-white px-4 py-2 font-semibold transform hover:scale-105 transition-transform"
              >
              How It Works
              </a>
              <button
                onClick={() => setShowUploadSection(true)}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 py-2 rounded-full font-bold transform hover:scale-105 transition-transform"
              >
                Upload Photo
              </button>
            <button
              onClick={() => {
                setActiveTab("login");
                setShowMembershipModal(true);
              }}
              className="bg-gradient-to-r from-pink-500 to-fuchsia-700 text-white px-5 py-2 rounded-full font-bold transform hover:scale-105 transition-transform"
            >
              Membership
            </button>
               <button
            onClick={() => router.push("/donate")}
            className="bg-yellow-400 text-gray-800  px-4 py-2 rounded-full font-bold inline-flex items-center hover:bg-yellow-300 transform hover:scale-105 transition-transform ml-[2px] fas fa-donate"
          > 
            <FontAwesomeIcon className= "mr-1" icon={faDonate} /> 
            Donate
          </button>
        </div>
        {showMainPics && (
          <motion.div
            className="flex flex-col items-center md:mt-[0vw] mt-[100px] "
            initial={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <div className="flex md:flex-row flex-col items-center justify-center gap-8 md:gap-12">
              <PersonSelector
                picUrl={mainPics[0]}
                inputValue={name1}
                onInputChange={(val) => {
                  setName1(val);
                  setHasSelectedSuggestion1(false);
                }}
                suggestions={suggestions1}
                onSuggestionSelect={(val) => {
                  setName1(val);
                  setSuggestions1([]);
                  setHasSelectedSuggestion1(true);
                }}
                cardClass="rounded-2xl"
                rotateClass1="card-rotate-negative3"
                rotateClass2="card-rotate-negative6"
              />
              
              {/* Chain Icon - Centered between PersonSelectors */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 md:w-6 md:h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-3.9 3.9a3 3 0 104.242 4.242l3.9-3.9a3 3 0 10-4.242-4.242z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.828 17l3.9-3.9a3 3 0 10-4.242-4.242l-3.9 3.9a3 3 0 104.242 4.242z"
                    />
                  </svg>
                </div>
              </div>
              
              <PersonSelector
                picUrl={mainPics[1]}
                inputValue={name2}
                onInputChange={(val) => {
                  setName2(val);
                  setHasSelectedSuggestion2(false);
                }}
                suggestions={suggestions2}
                onSuggestionSelect={(val) => {
                  setName2(val);
                  setSuggestions2([]);
                  setHasSelectedSuggestion2(true);
                }}
                cardClass="rounded-2xl"
                rotateClass1="card-rotate3 rounded-2xl"
                rotateClass2="card-rotate6 rounded-2xl"
              />
            </div>
            <button
              onClick={handleSubmit}
              className="bg-purple-600 text-white hover:bg-purple-700 hover:scale-105 px-10 py-2 rounded-lg mt-8 sm:mt-6 md:mt-4 font-semibold transition-all duration-200"
            >
              Find Connections
            </button>
            {connectionError && (
              <p className=" mt-2 text-red-500">{connectionError}</p>
            )}
          </motion.div>
        )}
        
        {showMembershipModal && (
          <div className="text-black fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-8 rounded shadow-md max-w-md w-full">
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => setActiveTab("login")}
                  className={`mr-2 p-2 ${activeTab === "login" ? "border-b-2 border-blue-500" : ""}`}
                >
                  Login
                </button>
                <button
                  onClick={() => setActiveTab("register")}
                  className={`ml-2 p-2 ${activeTab === "register" ? "border-b-2 border-blue-500" : ""}`}
                >
                  Register
                </button>
              </div>
              {activeTab === "login" && (
                <>
                  <h1 className="text-2xl font-bold mb-4">Login</h1>
                  <LoginForm />
                </>
              )}
              {activeTab === "register" && (
                <>
                  <h1 className="text-2xl font-bold mb-4">Register</h1>
                  <RegisterForm />
                </>
              )}
              <button
                onClick={() => setShowMembershipModal(false)}
                className="mt-4 text-sm text-gray-600 hover:underline block mx-auto"
              >
                Close
              </button>
            </div>
          </div>
        )}
        {showHowItWorks && (
          <div className="text-black fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-8 rounded max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">How It Works</h2>
                <p className="mb-4 text-justify">
                Our platform leverages the idea of <a href="https://en.wikipedia.org/wiki/Six_degrees_of_separation" target="_blank" className="text-blue-500 underline">six degrees of separation</a>. In our case, 
                a connection between two people means they appear together in the same 
                picture, either directly or through a short chain of others who share photos.
                </p>
                <h3 className="text-lg font-semibold mt-4 text-left">Wanna Contribute?</h3>
                <p className="mb-4 text-justify">
                Simply register for our platform in the Membership section. After you confirm your
                email, you will be directed to the profile page upon logging in. 
                There, you can choose a file, add details, and create new connections by 
                uploading pictures where two people appear together. If the connection guidelines 
                are met and the data is not already in our database, we will add your data.
                </p>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="mt-4 text-sm text-gray-600 hover:underline block mx-auto"
              >
                Close
              </button>
            </div>
          </div>
        )}
        
        {/* Upload Photo Modal */}
        {showUploadSection && (
          <div className="text-black fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-8 rounded-2xl max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-6 text-center">Upload Photo</h2>
              
              <div className="mb-6">
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">📋 Upload Guidelines</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Photo must contain exactly two people</li>
                    <li>• Only JPG, JPEG, or PNG formats accepted</li>
                    <li>• Maximum file size: 5MB</li>
                    <li>• Files are scanned for security before upload</li>
                    <li>• <strong>Filename format:</strong> firstperson_secondperson.jpg</li>
                    <li>• <strong>Example:</strong> johnsmith_janedoe.jpg</li>
                  </ul>
                </div>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    id="file-upload"
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <span className="text-gray-600 font-medium">
                      {uploadFile ? uploadFile.name : 'Click to select photo'}
                    </span>
                    <span className="text-gray-400 text-xs mt-1">
                      JPG, JPEG, PNG only (max 5MB)
                    </span>
                  </label>
                </div>
              </div>
              
              {uploadError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                  {uploadError}
                </div>
              )}
              
              {uploadMessage && (
                <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
                  {uploadMessage}
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploadLoading}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                    uploadFile && !uploadLoading
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transform hover:scale-105'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {uploadLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Uploading...
                    </div>
                  ) : (
                    'Upload Photo'
                  )}
                </button>
                
                <button
                  onClick={() => {
                    setShowUploadSection(false);
                    setUploadFile(null);
                    setUploadError("");
                    setUploadMessage("");
                    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                    if (fileInput) fileInput.value = '';
                  }}
                  className="flex-1 py-2 px-4 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </>
  );
}