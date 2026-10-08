import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { Select } from './Select';
import styles from './Field.module.css';

interface FieldWrapperProps {
    label: string;
    htmlFor: string;
    children: ReactNode;
}

function FieldWrapper({ label, htmlFor, children }: FieldWrapperProps) {
    return (
        <div className={styles.field}>
            <label htmlFor={htmlFor}>{label}</label>
            {children}
        </div>
    );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; id: string };

export function TextField({ label, id, ...rest }: TextFieldProps) {
    return (
        <FieldWrapper label={label} htmlFor={id}>
            <input id={id} {...rest} />
        </FieldWrapper>
    );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string };

export function TextArea({ label, id, ...rest }: TextAreaProps) {
    return (
        <FieldWrapper label={label} htmlFor={id}>
            <textarea id={id} {...rest} />
        </FieldWrapper>
    );
}

type SelectFieldProps = {
    label: string;
    id: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (event: { target: { value: string } }) => void;
    disabled?: boolean;
};

export function SelectField({ label, id, options, value, onChange, disabled }: SelectFieldProps) {
    return (
        <FieldWrapper label={label} htmlFor={id}>
            <Select
                id={id}
                value={value}
                options={options}
                disabled={disabled}
                onChange={v => onChange({ target: { value: v } })}
            />
        </FieldWrapper>
    );
}
