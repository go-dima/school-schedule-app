import React from "react";
import { useTranslation } from "react-i18next";

interface ClassTitleWithContinuationProps {
  title: string;
  isContinuation?: boolean;
  className: string;
}

const ClassTitleWithContinuation: React.FC<ClassTitleWithContinuationProps> = ({
  title,
  isContinuation = false,
  className,
}) => {
  const { t } = useTranslation();

  return (
    <div className={className}>
      {title}
      {isContinuation && (
        <span className="continuation-suffix">
          {t("schedule.table.continuationText")}
        </span>
      )}
    </div>
  );
};

export default ClassTitleWithContinuation;
