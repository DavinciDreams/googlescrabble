/**
 * Measures and reports Core Web Vitals performance metrics.
 *
 * @param {Function} [onPerfEntry] - An optional callback function that gets called
 *   for each metric that is measured. The function receives the metric object
 *   as its argument.
 *
 * @example
 * // Log results to the console
 * reportWebVitals(console.log);
 *
 * @example
 * // Send results to an analytics endpoint
 * reportWebVitals(({ name, delta, value, id }) => {
 *   const body = JSON.stringify({ name, delta, value, id });
 *   const url = 'https://your-analytics-endpoint.com/report';
 *
 *   // Use `navigator.sendBeacon()` if available, falling back to `fetch()`
 *   if (navigator.sendBeacon) {
 *     navigator.sendBeacon(url, body);
 *   } else {
 *     fetch(url, { body, method: 'POST', keepalive: true });
 *   }
 * });
 *
 * @see https://github.com/GoogleChrome/web-vitals
 * @see https://web.dev/vitals/
 */
const reportWebVitals = onPerfEntry => {
    // Check if the provided callback is a function. If not, do nothing.
    if (onPerfEntry && onPerfEntry instanceof Function) {
      // Dynamically import the 'web-vitals' library.
      // This ensures the library is only loaded if reporting is actually needed,
      // reducing the initial bundle size.
      import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        // Call the specific functions from the 'web-vitals' library.
        // Each function measures a specific metric and calls the provided
        // `onPerfEntry` callback with the result when it's ready.
  
        // Cumulative Layout Shift (CLS)
        getCLS(onPerfEntry);
  
        // First Input Delay (FID)
        getFID(onPerfEntry);
  
        // First Contentful Paint (FCP)
        getFCP(onPerfEntry);
  
        // Largest Contentful Paint (LCP)
        getLCP(onPerfEntry);
  
        // Time to First Byte (TTFB)
        getTTFB(onPerfEntry);
      }).catch(err => {
        // Handle potential errors during dynamic import
        console.error("Error loading web-vitals library:", err);
      });
    }
  };
  
  export default reportWebVitals;