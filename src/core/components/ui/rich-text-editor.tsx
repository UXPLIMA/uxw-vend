"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import "react-quill-new/dist/quill.snow.css";

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill-new"), {
    ssr: false,
    loading: () => (
        <div className="min-h-[300px] bg-muted rounded-md border border-input flex items-center justify-center">
            <span className="text-muted-foreground">Loading editor...</span>
        </div>
    ),
});

export function RichTextEditor({
    value,
    onChange,
    placeholder = "Write your content here...",
    className = "",
}: RichTextEditorProps) {
    // Quill modules configuration
    const modules = useMemo(
        () => ({
            toolbar: [
                [{ header: [1, 2, 3, 4, 5, 6, false] }],
                ["bold", "italic", "underline", "strike"],
                [{ color: [] }, { background: [] }],
                [{ list: "ordered" }, { list: "bullet" }],
                [{ indent: "-1" }, { indent: "+1" }],
                [{ align: [] }],
                ["blockquote", "code-block"],
                ["link", "image", "video"],
                ["clean"],
            ],
            clipboard: {
                matchVisual: false,
            },
        }),
        []
    );

    // Quill formats
    const formats = [
        "header",
        "bold",
        "italic",
        "underline",
        "strike",
        "color",
        "background",
        "list",
        "bullet",
        "indent",
        "align",
        "blockquote",
        "code-block",
        "link",
        "image",
        "video",
    ];

    return (
        <div className={`rich-text-editor ${className}`}>
            <ReactQuill
                theme="snow"
                value={value}
                onChange={onChange}
                modules={modules}
                formats={formats}
                placeholder={placeholder}
                className="bg-background rounded-md"
            />
            <style jsx global>{`
                .rich-text-editor .ql-container {
                    min-height: 300px;
                    font-size: 16px;
                    font-family: inherit;
                    border-bottom-left-radius: 0.375rem;
                    border-bottom-right-radius: 0.375rem;
                }
                .rich-text-editor .ql-toolbar {
                    border-top-left-radius: 0.375rem;
                    border-top-right-radius: 0.375rem;
                    background: #f8fafc;
                }
                .rich-text-editor .ql-editor {
                    min-height: 280px;
                }
                .rich-text-editor .ql-editor.ql-blank::before {
                    color: #9ca3af;
                    font-style: normal;
                }
            `}</style>
        </div>
    );
}
