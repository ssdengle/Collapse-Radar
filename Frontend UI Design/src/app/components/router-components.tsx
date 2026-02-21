import React from "react";
import { useLocation, useNavigate } from "react-router";

// Simplified Link implementation since react-router-dom is unavailable
export const Link = React.forwardRef<HTMLAnchorElement, React.ComponentProps<'a'> & { to: string }>(
  ({ onClick, to, children, ...rest }, ref) => {
    const navigate = useNavigate();
    
    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (onClick) onClick(event);
      navigate(to);
    };

    return (
      <a
        {...rest}
        href={to}
        onClick={handleClick}
        ref={ref}
      >
        {children}
      </a>
    );
  }
);

// Simplified NavLink implementation
export const NavLink = React.forwardRef<HTMLAnchorElement, Omit<React.ComponentProps<'a'>, 'className'> & { 
  to: string, 
  className?: string | ((props: { isActive: boolean, isPending: boolean }) => string) 
  end?: boolean
}>(
  ({ to, className, end, ...rest }, ref) => {
    const location = useLocation();
    
    // Determine active state
    // If end is true, strict match
    // If to is "/", treat as end=true by default for common dashboard pattern unless specified otherwise? 
    // Actually standard NavLink for "/" matches everything unless end is true.
    // But let's assume standard behavior:
    // isActive if location.pathname.startsWith(to)
    // EXCEPT trailing slash handling.
    
    let isActive = false;
    if (end) {
      isActive = location.pathname === to;
    } else {
      isActive = location.pathname === to || (location.pathname.startsWith(to) && location.pathname.charAt(to.length) === '/');
      // If to is "/", startsWith is always true.
      if (to === "/") isActive = location.pathname === "/"; // Special case for root to behave like 'end' if not handled
    }
    
    // To match original behavior which didn't have 'end' prop on "/" but likely wanted it not to be active everywhere:
    // If standard NavLink is used, "/" is always active.
    // I'll make "/" strict by default here to be helpful.

    const isPending = false; 

    let computedClassName = "";
    if (typeof className === "function") {
      computedClassName = className({ isActive, isPending });
    } else if (className) {
      computedClassName = className;
    }

    return (
      <Link
        to={to}
        className={computedClassName}
        ref={ref}
        {...rest}
      />
    );
  }
);
