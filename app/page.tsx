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
  const [showConnections, setShowConnections] = useState(false);
  interface Connection {
    segments: Segment[];
    imageUrls: string[];
  }

  const [connections, setConnections] = useState<Connection[]>([]);
  const [hoveredSegment, setHoveredSegment] = useState<Segment | null>(null);
  const [sliderValue, setSliderValue] = useState(0);
  const [showMainPics, setShowMainPics] = useState(true);
  const [mainPics, setMainPics] = useState<string[]>([]);
  const [suggestions1, setSuggestions1] = useState<string[]>([]);
  const [suggestions2, setSuggestions2] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState("");
  const [hasSelectedSuggestion1, setHasSelectedSuggestion1] = useState(false);
  const [hasSelectedSuggestion2, setHasSelectedSuggestion2] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [showHowItWorks, setShowHowItWorks] = useState(false);
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
        return;
      }
      // always fetch from API
      const res = await fetch(`/api/general/suggestions?query=`);
      const data = await res.json();
      const allNames: string[] = data.suggestions || [];
      const lowerQuery = name1.toLowerCase();
      const filtered = allNames.filter(n => n.toLowerCase().includes(lowerQuery));
      setSuggestions1(filtered.slice(0, 3)); // Limit to 3 suggestions
    }
    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [name1, hasSelectedSuggestion1]);

  useEffect(() => {
    async function fetchSuggestions() {
      if (name2.length < 2 || hasSelectedSuggestion2) {
        setSuggestions2([]);
        return;
      }
      //always fetch from API
      const res = await fetch(`/api/general/suggestions?query=`);
      const data = await res.json();
      const allNames: string[] = data.suggestions || [];
      const lowerQuery = name2.toLowerCase();
      const filtered = allNames.filter(n => n.toLowerCase().includes(lowerQuery));
      setSuggestions2(filtered.slice(0, 3)); // Limit to 3 suggestions
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

    setIsTransitioning(true);
    const response = await fetch(`/api/general/connections?name1=${encodeURIComponent(name1)}&name2=${encodeURIComponent(name2)}`, {
      method: 'GET',
      headers: {
      'Content-Type': 'application/json',
      },
    });
    const fetchedConnections = await response.json();
    setConnections(fetchedConnections);
    if (fetchedConnections.length > 0 && fetchedConnections[0].segments.length > 0) {
      setHoveredSegment(fetchedConnections[0].segments[0]);
      setSliderValue(0);
    } else {
      setConnectionError("Sorry, there is no connection between these two people. You can contribute so that in the future your connection may appear.");
    }
    
    setTimeout(() => {
      setTimeout(() => {
        setShowMainPics(false);
        setIsTransitioning(false);
      }, 1000); // Wait for the dots to disappear
      setShowConnections(true);
    }, 500); 
  };

  interface Segment {
    start: string;
    end: string;
    relationship: string;
  }

  const handleMouseEnter = (segment: Segment) => {
    setHoveredSegment(segment);
  };

  const handleMouseLeave = () => {
    setHoveredSegment(null);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setSliderValue(newValue);
    const index = Math.round(newValue);
    if (connections.length > 0 && connections[0].segments[index]) {
      setHoveredSegment(connections[0].segments[index]);
    }
  };

  const maxIndex =
    connections.length > 0 ? connections[0].segments.length - 1 : 0;

  const displaySegment =
    hoveredSegment || (connections.length > 0 ? connections[0].segments[0] : null);

  const handleBack = () => {
    setShowConnections(false);
    setShowMainPics(true);
  };

  return (
    <>
      <div className="min-h-screen w-full overflow-x-auto bg-gradient-to-r from-purple-800 to-blue-900 flex flex-col items-center justify-center p-4">
        {!showConnections && (
          <div className=" absolute top-4 right-4 flex space-x-4">
                <a
                href="#"
                onClick={() => setShowHowItWorks(true)}
                className="text-white px-4 py-2 font-semibold transform hover:scale-105 transition-transform"
                >
                How It Works
                </a>
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
        )}
        {showMainPics && (
          <motion.div
            className="flex flex-col items-center md:mt-[0vw] mt-[100px] "
            initial={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <div className="flex md:flex-row flex-col items-center gap-5">
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
      <div className="flex flex-col items-center">
        <div className="mb-2">
          <div className="w-8 h-8 :w-12 bg-blue-500 rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-white"
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
        {isTransitioning && (
          <div className="flex flex-row items-center space-x-2">
            <div className="w-2 h-2 md:w-4 md:h-4 bg-white rounded-full dot-animation" style={{ animationDelay: '0s' }}/>
            <div className="w-2 h-2 md:w-4 md:h-4 bg-white rounded-full animation-delay:0.2s dot-animation" style={{ animationDelay: '0.2s' }}/>
            <div className="w-2 h-2 md:w-4 md:h-4 bg-white rounded-full animation-delay:0.4s dot-animation" style={{ animationDelay: '0.4s' }}/>
          </div>
        )}
        {!isTransitioning && (
          <div className="flex flex-row items-center space-x-2">
            <div className="w-2 h-2 md:w-4 md:h-4 bg-purple-100 rounded-full " />
            <div className="w-2 h-2 md:w-4 md:h-4 bg-purple-200 rounded-full " />
            <div className="w-2 h-2 md:w-4 md:h-4 bg-purple-300 rounded-full  "/>
          </div>
        )}
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
              className="bg-purple-600 text-white px-10 py-2 rounded-lg hover:bg-purple-700 mt-8 sm:mt-6 md:mt-4"
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
                <p className="mb-4 text-left text-justify">
                Our platform leverages the idea of <a href="https://en.wikipedia.org/wiki/Six_degrees_of_separation" target="_blank" className="text-blue-500 underline">six degrees of separation</a>. In our case, 
                a connection between two people means they appear together in the same 
                picture, either directly or through a short chain of others who share photos.
                </p>
                <h3 className="text-lg font-semibold mt-4 text-left">Wanna Contribute?</h3>
                <p className="mb-4 text-left text-justify">
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
  
        {showConnections && !isTransitioning && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div style={{ transition: "opacity 0.5s", opacity: 1 }} className= "w-[80vw] md:mb-[0px] mb-[300px] ">
              <div className="text-center">
                <h1 className="text-2xl  font-bold mb-2 text-white">
                  Connections between{" "}
                  <span className="text-purple-300">{name1}</span> and{" "}
                  <span className="text-purple-300">{name2}</span>
                </h1>
              </div>
              <div className="image-wrapper relative mt-4 mb-[300px]">
                {connections.length === 0 && (
                  <><div className="flex flex-col items-center justify-center">
                    <p className=" flex mt-2 text-red-500">
                      Sorry, there is no connection between these two people. You can contribute so that in the future your connection may appear.
                    </p>
                    <div className="flex justify-center items-center mt-4">
                      <button
                      onClick={handleBack}
                      className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                      style={{ width: '80px', height: '40px' }}
                      >
                      Back
                      </button>
                    </div>
                    </div>
                  </>
                )}
                {connections.map((connection, index) => (
                  <div key={index} className="mb-6">
                    {connection.segments.map((segment: Segment, idx: number) => {
                      const isSmallScreen = window.innerWidth <= 768;
                      const baseTransform = isSmallScreen
                        ? `rotate(0deg)
                           translateY(${(idx ) * 75 }px)
                           translateX(-50px)`
                        : `rotate(${(idx - connection.segments.length / 2) * 1}deg)
                           translateY(${Math.abs(idx - connection.segments.length / 2) * 1}px)
                           translateX(${(idx - connection.segments.length / 2) * 100 }px)`;
                      const isActive =
                        hoveredSegment &&
                        hoveredSegment.start === segment.start &&
                        hoveredSegment.end === segment.end;
                        const extraTransform = isActive 
                        ? isSmallScreen 
                          ? " translateY(-50px) scale(1.1)" 
                          : " translateX(-100px) scale(1.1)" 
                        : "";
                      return (
                        <div
                          key={idx}
                          className="image-container "
                          style={{ transform: baseTransform + extraTransform }}
                          onMouseEnter={() => handleMouseEnter(segment)}
                          onMouseLeave={handleMouseLeave}
                        >
                          {connection.imageUrls[idx] ? (
                            <img
                              width={300}
                              height={300}
                              src={connection.imageUrls[idx]}
                              alt="Connection Image"
                              className="rounded-lg  object-fit w-full h-full transition-transform transform"
                            />
                          ) : (
                            <p className="text-gray-400 text-sm mt-2 mr-4">
                              No image available
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              {connections?.[0]?.segments?.length > 0 && (
                <div className="md:mt-[270px] md:mr-[0px]  mr-[150px] flex flex-col justify-center items-center">
                  <input
                  type="range"
                  min="0"
                  max={maxIndex}
                  step="0.01"
                  value={sliderValue}
                  onInput={handleSliderChange}
                  style={{
                  width: window.innerWidth >= 765 ?  `${connections[0].segments.length * 100}px` : `${connections[0].segments.length * 75}px`,
                  transform: window.innerWidth < 765 ? `rotate(90deg)  translateY(100px) translateX(${connections[0].segments.length * 35 - 300}px)` : 'translateX(0px)',
                  }}
                  />
                  {displaySegment && (
                  <div className="text-wrapper  text-center ml-[440px] md:ml-[0px]">
                  <div className="text-container">
                  <p className="text-lg font-semibold text-white">{displaySegment.start}</p>
                  <p className="text-sm text-purple-200">
                    {displaySegment.relationship}
                  </p>
                  <p className="text-lg font-semibold text-white">{displaySegment.end}</p>
                  </div>
                  </div>
                  )}
                    <div className="flex justify-center mt-6">
                  <button
                  onClick={handleBack}
                  className="ml-[440px] md:ml-[0px] bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                  style={{ width: '80px', height: '40px' }}
                  >
                  Back
                  </button>
                </div>
                </div>
                
              )}
              
            </div>
        
          </motion.div>
        )}
        
      </div>
    </>
  );
}