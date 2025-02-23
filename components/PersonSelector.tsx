import { motion } from "framer-motion";

type PersonSelectorProps = {
  picUrl?: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  suggestions: string[];
  onSuggestionSelect: (value: string) => void;
  cardClass: string; // e.g. "rounded-lg" vs "rounded-2xl"
  rotateClass1: string; // e.g. "card-rotate-negative3"
  rotateClass2: string; // e.g. "card-rotate-negative6"
};

export default function PersonSelector({
  picUrl,
  inputValue,
  onInputChange,
  suggestions,
  onSuggestionSelect,
  cardClass,
  rotateClass1,
  rotateClass2,
}: PersonSelectorProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={`absolute top-0 left-0 w-[180px] h-[270px] bg-white bg-opacity-50 shadow-2xl rounded-2xl ${rotateClass1}`}
        />
        <div
          className={`absolute top-0 left-0 w-[180px] h-[270px] bg-white bg-opacity-50 shadow-2xl rounded-2xl ${rotateClass2}`}
        />
        <motion.div
          className={`relative z-10 bg-white  bg-opacity-90 shadow-2xl p-2 w-[180px] h-[270px] flex flex-col items-left justify-center ${cardClass}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {picUrl && (
            <>
              <img
                src={`/Famous-pics/${picUrl}`}
                alt="Person"
                className=" w-[170px] h-[170px] object-cover rounded-2xl relative "
              />
              {(() => {
                const parts = picUrl.split("_");
                if (parts.length > 1) {
                  const fullname = parts[0];
                  const career =  parts[1].replace(".jpg", "");
                  return (
                    <div className="text-left ">
                        <p className="font-semibold text-black min-h-[50px]">{fullname}</p>
                      <p className="text-xs text-black ">{career}</p>
                    </div>
                  );
                }
                return null;
              })()}
            </>
          )}
        </motion.div>
      </div>
      <input
        type="text"
        placeholder="Person's Name"
        className="mt-[30px] p-2 border rounded-2xl bg-purple-100 text-purple-900 placeholder-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
      />
      {suggestions.length > 0 && (
        <ul className="w-[200px] bg-purple-100 border border-purple-300 rounded-2xl text-black">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => onSuggestionSelect(suggestion)}
              className="p-2 hover:bg-gray-200 cursor-pointer rounded-3xl"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}