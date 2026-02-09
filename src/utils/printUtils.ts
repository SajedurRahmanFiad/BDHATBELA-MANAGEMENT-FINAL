/**
 * Utility function to navigate to print page and open print dialog
 * @param orderId - The ID of the order to print
 * @param navigate - React Router navigate function
 */
export const handlePrintOrder = (orderId: string, navigate: any) => {
  // Navigate to print page in the same tab
  navigate(`/print-order/${orderId}`);
};

/**
 * Trigger browser print dialog after page loads
 * Call this in useEffect after order data is loaded
 */
export const triggerPrintDialog = () => {
  // Give the browser a moment to render the content before opening print dialog
  setTimeout(() => {
    window.print();
  }, 100);
};
