import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { PlusOutlined, UserOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { TextSearchSheet } from "../components/TextSearchSheet";
import { GetGradeName } from "../utils/grades";
import { studentName } from "../utils/personName";
import type { Child } from "../types";
import { mockStudents } from "./fixtures/studentFixtures";

// The staff student picker's sheet: rows with an icon and the grade
// (renderOption), and the "add student" row for a name nothing matches
// (extraOption; type a name that isn't listed to see it).
const Demo = ({
  initial,
  withExtra,
}: {
  initial?: string;
  withExtra: boolean;
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState<string | undefined>(initial);
  const [added, setAdded] = useState<string>();
  return (
    <>
      <TextSearchSheet<Child>
        mode="pick"
        items={mockStudents}
        getText={studentName}
        getKey={s => s.id}
        renderOption={s => (
          <span>
            <UserOutlined /> {studentName(s)} - {GetGradeName(s.grade)}
          </span>
        )}
        extraOption={
          withExtra
            ? {
                label: query => (
                  <span>
                    <PlusOutlined />{" "}
                    {t("students.search.addStudent", { name: query })}
                  </span>
                ),
                onSelect: setAdded,
              }
            : undefined
        }
        value={value}
        onSelect={s => setValue(s?.id)}
        placeholder={t("schedule.page.placeholders.selectChildForStaff")}
      />
      {added && <p>{t("students.search.addStudent", { name: added })}</p>}
    </>
  );
};

const meta: Meta<typeof Demo> = {
  title: "Components/TextSearchSheet",
  component: Demo,
  parameters: { layout: "padded", viewport: { defaultViewport: "mobile1" } },
};
export default meta;
type Story = StoryObj<typeof Demo>;

export const Default: Story = { args: { withExtra: true } };

/** A picked student shows in the field, with its clear button. */
export const Picked: Story = {
  args: { initial: mockStudents[2].id, withExtra: true },
};
