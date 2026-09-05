import { coreScreenMetadata } from "@/core/lib/core-screens";

export const generateMetadata = coreScreenMetadata("/auth/login");

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
