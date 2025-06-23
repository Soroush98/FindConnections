"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from 'next/image';
import { motion } from "framer-motion";

function ConnectionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const name1 = searchParams?.get('name1') || '';
  const name2 = searchParams?.get('name2') || '';
  
  interface Connection {
    segments: Segment[];
    imageUrls: string[];
  }

  interface Segment {
    start: string;
    end: string;
    relationship: string;
  }

  const [connections, setConnections] = useState<Connection[]>([]);
  const [hoveredSegment, setHoveredSegment] = useState<Segment | null>(null);
  const [sliderValue, setSliderValue] = useState(0);
  const [connectionError, setConnectionError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!name1 || !name2) {
      router.push('/');
      return;
    }
    
    const fetchConnections = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/general/connections?name1=${encodeURIComponent(name1)}&name2=${encodeURIComponent(name2)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const fetchedConnections = await response.json();
        setConnections(fetchedConnections);
        
        if (fetchedConnections.length > 0 && fetchedConnections[0].segments.length > 0) {
          setHoveredSegment(fetchedConnections[0].segments[0]);
          setSliderValue(0);
        } else {
          setConnectionError("Sorry, there is no connection between these two people. You can contribute so that in the future your connection may appear.");
        }
      } catch (error) {
        console.error("Error fetching connections:", error);
        setConnectionError("An error occurred while searching for connections. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchConnections();
  }, [name1, name2, router]);

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

  const maxIndex = connections.length > 0 ? connections[0].segments.length - 1 : 0;
  const displaySegment = hoveredSegment || (connections.length > 0 ? connections[0].segments[0] : null);

  const handleBack = () => {
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-purple-800 to-blue-900 flex items-center justify-center">
        <motion.div
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-white text-lg font-semibold">Searching for connections...</p>
          <p className="text-purple-200 text-sm mt-2">Between {name1} and {name2}</p>
        </motion.div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-800 to-blue-900 flex flex-col p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-6xl mx-auto flex-1 flex flex-col"
      >        {/* Header Section */}
        <div className="text-center mb-4 md:mb-6 pt-2 md:pt-4">
          <motion.h1 
            className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Connection Results
          </motion.h1>
          <motion.div
            className="flex items-center justify-center mb-3"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3">
              <span className="text-purple-300 font-semibold text-lg">{name1}</span>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
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
              <span className="text-purple-300 font-semibold text-lg">{name2}</span>
            </div>
          </motion.div>
        </div>{/* No Connections Found */}
        {connectionError && (
          <motion.div 
            className="flex-1 flex flex-col items-center justify-center text-center px-4 min-h-[400px]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 md:p-12 max-w-2xl">
              <div className="text-5xl md:text-6xl mb-6">🔍</div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-4">
                No Connection Found
              </h3>
              <p className="text-purple-200 mb-8 leading-relaxed">
                {connectionError}
              </p>
              <button
                onClick={handleBack}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-full font-semibold hover:from-purple-700 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
              >
                Try Another Search
              </button>
            </div>
          </motion.div>
        )}        {/* Connections Display */}
        {connections.length > 0 && (
          <div className="flex-1 flex flex-col space-y-4">
            {/* Connection Path Indicator */}
            <motion.div 
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span className="text-purple-200 text-sm">
                  {connections[0].segments.length} step{connections[0].segments.length !== 1 ? 's' : ''} connection
                </span>
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              </div>
            </motion.div>

            {/* Mobile Layout */}
            <div className="md:hidden flex-1">
              <div className="space-y-4">
                {connections[0].segments.map((segment: Segment, idx: number) => {
                  const isActive = hoveredSegment && 
                    hoveredSegment.start === segment.start && 
                    hoveredSegment.end === segment.end;
                  return (
                    <motion.div
                      key={idx}
                      className={`relative bg-white/10 backdrop-blur-sm rounded-2xl p-4 transition-all duration-300 ${
                        isActive ? 'bg-white/20 scale-105 shadow-2xl' : 'hover:bg-white/15'
                      }`}
                      initial={{ opacity: 0, x: -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + idx * 0.1 }}
                      onClick={() => handleMouseEnter(segment)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {connections[0].imageUrls[idx] ? (
                            <div className="relative overflow-hidden rounded-xl">
                              <Image
                                width={100}
                                height={100}
                                src={connections[0].imageUrls[idx]}
                                alt="Connection"
                                className="object-cover w-[100px] h-[100px]"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                            </div>
                          ) : (
                            <div className="w-[100px] h-[100px] bg-purple-500/20 rounded-xl flex items-center justify-center">
                              <span className="text-white/60 text-xs text-center">No image</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center mb-2">
                            <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded-full mr-2">
                              Step {idx + 1}
                            </span>
                            {idx < connections[0].segments.length - 1 && (
                              <div className="flex-1 h-px bg-purple-300/30"></div>
                            )}
                          </div>
                          <p className="text-white font-semibold text-base mb-1 truncate">
                            {segment.start}
                          </p>
                          <p className="text-purple-200 text-sm mb-2 italic">
                            {segment.relationship}
                          </p>
                          <p className="text-white font-semibold text-base truncate">
                            {segment.end}
                          </p>
                        </div>
                      </div>
                      {isActive && (
                        <div className="absolute top-2 right-2">
                          <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>            {/* Desktop Layout */}
            <div className="hidden md:flex flex-1 flex-col">
              <div className="flex justify-center items-center flex-wrap gap-4 lg:gap-6 mb-6 px-4 max-w-5xl mx-auto">
                {connections[0].segments.map((segment: Segment, idx: number) => {
                  const isActive = hoveredSegment && 
                    hoveredSegment.start === segment.start && 
                    hoveredSegment.end === segment.end;

                  return (
                    <motion.div
                      key={idx}
                      className="flex-shrink-0 cursor-pointer relative"
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ 
                        delay: 0.5 + idx * 0.1,
                        duration: 0.4
                      }}
                      onMouseEnter={() => handleMouseEnter(segment)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div className={`relative group transition-all duration-300 ${
                        isActive ? 'scale-110 z-20' : 'scale-100 hover:scale-105'
                      }`}>
                        {connections[0].imageUrls[idx] ? (
                          <div className="relative overflow-hidden rounded-2xl shadow-2xl">
                            <Image
                              width={140}
                              height={140}
                              src={connections[0].imageUrls[idx]}
                              alt="Connection"
                              className="object-cover w-[140px] h-[140px] lg:w-[160px] lg:h-[160px] transition-all duration-300"
                            />
                            <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${
                              isActive ? 'opacity-80' : 'opacity-40'
                            }`} />
                            {isActive && (
                              <div className="absolute inset-0 border-4 border-yellow-400 rounded-2xl animate-pulse" />
                            )}
                          </div>
                        ) : (
                          <div className="w-[140px] h-[140px] lg:w-[160px] lg:h-[160px] bg-purple-500/20 rounded-2xl flex items-center justify-center border-2 border-purple-400/30">
                            <span className="text-white/60 text-center text-sm">No image available</span>
                          </div>
                        )}
                        
                        {/* Connection indicator */}
                        <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
                          <div className={`bg-purple-500 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-lg transition-all duration-300 ${
                            isActive ? 'bg-yellow-500 scale-110' : ''
                          }`}>
                            {idx + 1}
                          </div>
                        </div>

                        {/* Connection arrow (except for last item) - positioned relative to layout */}
                        {idx < connections[0].segments.length - 1 && (
                          <div className="absolute top-1/2 -right-3 lg:-right-4 transform -translate-y-1/2 z-10">
                            <motion.div 
                              className="w-4 h-4 lg:w-5 lg:h-5"
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.8 + idx * 0.1 }}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-full h-full text-purple-300 drop-shadow-lg"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                              </svg>
                            </motion.div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>{/* Connection Details and Controls */}
            <div className="text-center space-y-4 pb-6">
              {displaySegment && (
                <motion.div 
                  className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 max-w-md mx-auto"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  key={`${displaySegment.start}-${displaySegment.end}`}
                >
                  <div className="text-center">
                    <p className="text-lg md:text-xl font-bold text-white mb-2">
                      {displaySegment.start}
                    </p>
                    <div className="flex items-center justify-center mb-2">
                      <div className="h-px bg-purple-300 flex-1" />
                      <span className="px-3 text-purple-200 italic text-sm">
                        {displaySegment.relationship}
                      </span>
                      <div className="h-px bg-purple-300 flex-1" />
                    </div>
                    <p className="text-lg md:text-xl font-bold text-white">
                      {displaySegment.end}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Progress Slider - Desktop Only */}
              <div className="hidden md:block">
                <motion.div 
                  className="max-w-lg mx-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                >
                  <input
                    type="range"
                    min="0"
                    max={maxIndex}
                    step="0.01"
                    value={sliderValue}
                    onChange={handleSliderChange}
                    className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-sm text-purple-200 mt-2">
                    <span>{name1}</span>
                    <span>{name2}</span>
                  </div>
                </motion.div>
              </div>

              {/* Back Button */}
              <motion.button
                onClick={handleBack}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2.5 md:px-8 md:py-3 rounded-full font-semibold hover:from-purple-700 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
              >
                ← Back to Search
              </motion.button>            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-r from-purple-800 to-blue-900 flex items-center justify-center">
        <motion.div
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-white text-lg font-semibold">Loading...</p>
        </motion.div>
      </div>
    }>
      <ConnectionsPageContent />
    </Suspense>
  );
}
