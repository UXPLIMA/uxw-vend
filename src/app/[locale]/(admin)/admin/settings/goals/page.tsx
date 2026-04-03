"use client";
import { SettingsForm } from "../settings-form";

export default function GoalsSettingsPage() {
    return (
        <SettingsForm
            title="Community Goals"
            subtitle="Set revenue targets to motivate your community"
            fields={[
                { key: "community_goal_title", label: "Goal Title", placeholder: "Monthly Goal", description: "Displayed in the sidebar widget" },
                { key: "community_goal_target", label: "Target Amount ($)", type: "number", placeholder: "5000", description: "Revenue goal amount" },
                { key: "community_goal_end_date", label: "End Date", placeholder: "2026-12-31", description: "Optional: when the goal period ends (YYYY-MM-DD)" },
            ]}
        />
    );
}
