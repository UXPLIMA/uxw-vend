"use client";

import React from "react";
import type { ComponentConfig } from "@measured/puck";
import { SliderWidget } from "../widgets/slider-widget";

/**
 * Puck page-builder block: SliderHero
 * Embeds the site's configured slider as a full-width hero element
 * inside a custom page. Wraps the existing SliderWidget so the same
 * slides and admin configuration drive both surfaces.
 */

interface SliderHeroProps {
    maxWidth: "full" | "container";
}

function SliderHeroRender({ maxWidth }: SliderHeroProps): React.ReactElement {
    if (maxWidth === "full") {
        return (
            <div className="w-full">
                <SliderWidget />
            </div>
        );
    }
    return (
        <div className="container mx-auto px-4 py-4">
            <SliderWidget />
        </div>
    );
}

const SliderHero: ComponentConfig<SliderHeroProps> = {
    fields: {
        maxWidth: {
            type: "select",
            label: "Width",
            options: [
                { label: "Container", value: "container" },
                { label: "Full width", value: "full" },
            ],
        },
    },
    defaultProps: {
        maxWidth: "container",
    },
    render: SliderHeroRender,
};

export default SliderHero;
