import React from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'

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
              This card demonstrates Tailwind&apos;s color palette, shadows, and hover effects.
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

        {/* Shadcn/UI Components Section */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6">Shadcn/UI Components</h3>

          {/* Shadcn/UI Buttons */}
          <div className="mb-8">
            <h4 className="text-lg font-medium text-gray-700 mb-4">Shadcn/UI Buttons</h4>
            <div className="flex flex-wrap gap-4">
              <Button>Default Button</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>

          {/* Shadcn/UI Cards */}
          <div className="mb-8">
            <h4 className="text-lg font-medium text-gray-700 mb-4">Shadcn/UI Cards</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Default Card</CardTitle>
                  <CardDescription>This is a simple card component</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Card content goes here with some example text.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Features Card
                    <Badge>New</Badge>
                  </CardTitle>
                  <CardDescription>Card with badges and features</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Feature 1</Badge>
                      <span className="text-sm">Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Feature 2</Badge>
                      <span className="text-sm">Coming Soon</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Interactive Card</CardTitle>
                  <CardDescription>Card with buttons and actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">This card has interactive elements.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">Action 1</Button>
                    <Button size="sm">Action 2</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Shadcn/UI Badges */}
          <div className="mb-8">
            <h4 className="text-lg font-medium text-gray-700 mb-4">Shadcn/UI Badges</h4>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge className="bg-green-500">Success</Badge>
              <Badge className="bg-yellow-500">Warning</Badge>
              <Badge className="bg-purple-500">Custom</Badge>
            </div>
          </div>

          {/* Comparison Section */}
          <div className="border-t pt-6">
            <h4 className="text-lg font-medium text-gray-700 mb-4">Tailwind vs Shadcn/UI Comparison</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-medium text-gray-600 mb-2">Raw Tailwind Buttons</h5>
                <div className="space-y-2">
                  <button className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 w-full">
                    Tailwind Button
                  </button>
                  <button className="bg-transparent hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 border border-gray-400 rounded-lg transition-colors duration-200 w-full">
                    Tailwind Outline
                  </button>
                </div>
              </div>
              <div>
                <h5 className="font-medium text-gray-600 mb-2">Shadcn/UI Buttons</h5>
                <div className="space-y-2">
                  <Button className="w-full">Shadcn/UI Button</Button>
                  <Button variant="outline" className="w-full">Shadcn/UI Outline</Button>
                </div>
              </div>
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
  )
}

export default TailwindTest
