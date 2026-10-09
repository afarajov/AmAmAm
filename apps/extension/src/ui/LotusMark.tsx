interface LotusMarkProps {
  className?: string;
}

export function LotusMark({ className = "" }: LotusMarkProps) {
  return (
    <svg
      className={`contextlayer-lotus ${className}`.trim()}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <path
        className="contextlayer-lotus-petal contextlayer-lotus-outer-left"
        d="M16 28C12.5 26 12 21 16 14C20 21 19.5 26 16 28Z"
      />
      <path
        className="contextlayer-lotus-petal contextlayer-lotus-outer-right"
        d="M16 28C12.5 26 12 21 16 14C20 21 19.5 26 16 28Z"
      />
      <path
        className="contextlayer-lotus-petal contextlayer-lotus-inner-left"
        d="M16 28C11.5 26 10.5 18 16 8C21.5 18 20.5 26 16 28Z"
      />
      <path
        className="contextlayer-lotus-petal contextlayer-lotus-inner-right"
        d="M16 28C11.5 26 10.5 18 16 8C21.5 18 20.5 26 16 28Z"
      />
      <path
        className="contextlayer-lotus-center"
        d="M16 28.5C10.5 24 11 13 16 3.5C21 13 21.5 24 16 28.5Z"
      />
    </svg>
  );
}
