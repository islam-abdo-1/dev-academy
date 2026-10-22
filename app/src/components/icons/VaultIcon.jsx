export default function VaultIcon({ className = "w-7 h-7" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 7.25A2.25 2.25 0 0 1 5.25 5h4.19c.6 0 1.17.24 1.59.66L12.5 7h6.25A2.25 2.25 0 0 1 21 9.25v8.5A2.25 2.25 0 0 1 18.75 20H5.25A2.25 2.25 0 0 1 3 17.75V7.25Z"
        fill="currentColor"
      />
      <path
        d="M7 11h10"
        stroke="#0B1220"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle cx="12" cy="15" r="1.4" fill="#0B1220" opacity="0.7" />
    </svg>
  );
}
