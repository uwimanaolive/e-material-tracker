import React from "react";
import { UPLOAD_BASE_URL } from "../api/client";
import { FileText, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";

export const getAttachmentUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${UPLOAD_BASE_URL}${path}`;
};

const isImage = (path) => /\.(jpe?g|png|gif|webp)$/i.test(path || "");

export const AttachmentViewer = ({ attachment, label = "Proof / Attachment" }) => {
  if (!attachment) return null;

  const url = getAttachmentUrl(attachment);
  const filename = attachment.split("/").pop();

  return (
    <div>
      <p className="text-sm font-medium mb-2">{label}</p>
      {isImage(attachment) ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={url}
            alt="Report attachment"
            className="max-h-48 rounded-lg border border-border object-contain"
          />
        </a>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground truncate flex-1">{filename}</span>
          <Button variant="outline" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              View
            </a>
          </Button>
        </div>
      )}
    </div>
  );
};
