
import { AppSidebar } from "./components/AppSidebar";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const rootRoute = createRootRoute({
    component: () => {
        return (
            <>
                <SidebarProvider>
                    <AppSidebar />
                    <SidebarInset>
                        <main className="w-full h-full max-w-3xl mx-auto">
                            <Outlet />
                        </main>
                    </SidebarInset>
                </SidebarProvider>
            </>
        );
    }
});