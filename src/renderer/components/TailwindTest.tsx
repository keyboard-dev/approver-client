import React from 'react';

const TailwindTest: React.FC = () => {
  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
          🎉 Tailwind CSS Test Component
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 - Colors and Shadows */}
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
            <div className="w-12 h-12 bg-blue-500 rounded-full mb-4 flex items-center justify-center">
              <span className="text-white font-bold text-xl">1</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Colors & Shadows</h3>
            <p className="text-gray-600">
              This card demonstrates Tailwind's color palette, shadows, and hover effects.
            </p>
          </div>

          {/* Card 2 - Spacing and Typography */}
          <div className="bg-gradient-to-r from-purple-400 to-pink-400 rounded-lg p-6 text-white">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full mb-4 flex items-center justify-center">
              <span className="text-white font-bold text-xl">2</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Gradients & Spacing</h3>
            <p className="text-white text-opacity-90">
              Beautiful gradients and consistent spacing using Tailwind utilities.
            </p>
          </div>

          {/* Card 3 - Flexbox and Grid */}
          <div className="bg-green-100 border-l-4 border-green-500 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 ml-3">Layout System</h3>
            </div>
            <p className="text-gray-700">
              Responsive grid and flexbox layouts made simple with Tailwind.
            </p>
          </div>
        </div>

        {/* Button Examples */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <button className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200">
            Primary Button
          </button>
          <button className="bg-transparent hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 border border-gray-400 rounded-lg transition-colors duration-200">
            Secondary Button
          </button>
          <button className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200">
            Danger Button
          </button>
        </div>

        {/* Form Elements */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Form Elements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text Input
              </label>
              <input
                type="text"
                placeholder="Enter some text..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Dropdown
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option>Option 1</option>
                <option>Option 2</option>
                <option>Option 3</option>
              </select>
            </div>
          </div>
        </div>

        {/* Responsive Text */}
        <div className="mt-8 text-center">
          <p className="text-sm md:text-base lg:text-lg xl:text-xl text-gray-600">
            This text changes size based on screen width: 
            <span className="font-semibold text-blue-600"> responsive typography!</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default TailwindTest; 