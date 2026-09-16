import React from "react";
import { useTranslation } from "react-i18next";

interface ClassCardHeaderProps {
  title: string;
  isContinuation?: boolean;
  teacher?: string;
  room?: string;
  tags?: React.ReactNode;
}

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
      {(teacher || room || tags) && (
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
          {tags && <span className="class-header-tags-inline">{tags}</span>}
        </div>
      )}
    </>
  );
};

export default ClassCardHeader;
