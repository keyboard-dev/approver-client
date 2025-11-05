import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
      visibleToasts={1}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-gray-900 group-[.toaster]:border group-[.toaster]:border-gray-200 group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg",
          description: "group-[.toast]:text-gray-600",
          actionButton:
            "group-[.toast]:bg-blue-600 group-[.toast]:text-white group-[.toast]:hover:bg-blue-700",
          cancelButton:
            "group-[.toast]:bg-gray-100 group-[.toast]:text-gray-700 group-[.toast]:hover:bg-gray-200",
          success: "group-[.toast]:border-green-200 group-[.toast]:bg-green-50",
          error: "group-[.toast]:border-red-200 group-[.toast]:bg-red-50",
          warning: "group-[.toast]:border-yellow-200 group-[.toast]:bg-yellow-50",
          info: "group-[.toast]:border-blue-200 group-[.toast]:bg-blue-50",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }