"use client";

import * as React from "react";
import { SignInForm } from "./sign-in-form";

export function SignInPageWrapper() {
	const [verificationStep, setVerificationStep] = React.useState<'email' | 'code'>('email');

	function handleVerificationStepChange(step: 'email' | 'code') {
		setVerificationStep(step);
	}

	return (
		<SignInForm 
			verificationStep={verificationStep}
			onVerificationStepChange={handleVerificationStepChange}
		/>
	);
}