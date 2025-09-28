// a tiny inline spinner so we don’t depend on any CSS or libraries
export function Spinner() {
  // an SVG with a simple rotate animation; accessible label included
  return (
    <span role="status" aria-live="polite" aria-label="Loading">
      <svg
        viewBox="0 0 50 50"
        width="20"
        height="20"
        aria-hidden="true"
        style={{ verticalAlign: 'middle' }}
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          stroke="currentColor"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="31.4 31.4"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 25 25"
            to="360 25 25"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </span>
  );
}
