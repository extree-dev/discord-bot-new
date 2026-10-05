import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
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

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    id: string;
    options: { value: string; label: string }[];
};

export function SelectField({ label, id, options, ...rest }: SelectFieldProps) {
    return (
        <FieldWrapper label={label} htmlFor={id}>
            <select id={id} {...rest}>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </FieldWrapper>
    );
}
