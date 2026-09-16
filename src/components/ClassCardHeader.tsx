import React from "react";
import { useTranslation } from "react-i18next";

interface ClassCardHeaderProps {
  title: string;
  isContinuation?: boolean;
  teacher?: string;
  room?: string;
  tags?: React.ReactNode;
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
      {tags && <div className="class-tags-row">{tags}</div>}
    </>
  );
};

export default ClassCardHeader;
