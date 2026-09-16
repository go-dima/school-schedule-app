import React from "react";
import { useTranslation } from "react-i18next";

interface ClassCardHeaderProps {
  title: string;
  isContinuation?: boolean;
  teacher?: string;
  room?: string;
  tags?: React.ReactNode;
  // The enrollment count badge is a fixed bottom-right overlay (see
  // .class-enrollment-badge), not part of this 3-line flow -- but the tags
  // row is the last line, so without reserved space the badge sits right on
  // top of whichever tag ends up in that corner. Only ClassCard (which
  // renders the badge) ever passes this.
  reserveBadgeSpace?: boolean;
}

// Fixed 3-line layout: title / teacher+room / tags, each its own row --
// never inlined together, so every card reads the same regardless of how
// long the title or teacher name is.
const ClassCardHeader: React.FC<ClassCardHeaderProps> = ({
  title,
  isContinuation = false,
  teacher,
  room,
  tags,
  reserveBadgeSpace = false,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="class-title">
        {title}
        {isContinuation && (
          <span className="continuation-suffix">
            {t("schedule.table.continuationText")}
          </span>
        )}
      </div>
      {(teacher || room) && (
        <div className="class-teacher-room">
          {teacher && <span className="class-teacher">{teacher}</span>}
          {teacher && room && (
            <span className="class-teacher-room-sep"> • </span>
          )}
          {room && (
            <span className="class-room">
              {t("schedule.table.room", { room })}
            </span>
          )}
        </div>
      )}
      {tags && (
        <div
          className={`class-tags-row ${
            reserveBadgeSpace ? "class-tags-row--with-badge" : ""
          }`}>
          {tags}
        </div>
      )}
    </>
  );
};

export default ClassCardHeader;
