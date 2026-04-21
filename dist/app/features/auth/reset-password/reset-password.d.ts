import { OnInit } from '@angular/core';
export declare class ResetPassword implements OnInit {
    private readonly authService;
    private readonly router;
    private readonly route;
    password: string;
    passwordConfirm: string;
    accessToken: string;
    loading: any;
    error: any;
    success: any;
    showPassword: any;
    invalidToken: any;
    ngOnInit(): void;
    togglePassword(): void;
    onSubmit(): void;
}
//# sourceMappingURL=reset-password.d.ts.map