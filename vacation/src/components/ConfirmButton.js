'use client';

// 누르기 전에 확인 창을 띄우는 제출 버튼
export default function ConfirmButton({ message, children, className = '', ...rest }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
