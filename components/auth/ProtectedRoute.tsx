import React from 'react';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    // This component will be enhanced after we integrate with routing
    return <>{children}</>;
};

export default ProtectedRoute;
