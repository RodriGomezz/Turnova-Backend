import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { SeoService } from '../../core/services/seo.service';

type CountdownValue = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

@Component({
  selector: 'app-preventa',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './preventa.html',
  styleUrl: './preventa.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Preventa implements OnInit, OnDestroy {
  private readonly seo = inject(SeoService);
  private readonly launchDate = new Date(environment.prelaunchLaunchDate);
  private timerId: ReturnType<typeof setInterval> | null = null;

  protected readonly countdown = signal<CountdownValue>({
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00',
  });

  protected readonly launchReached = signal(false);

  protected readonly chips = [
    'Reservas online 24/7',
    'Recordatorios automaticos',
    'Sin WhatsApp, sin llamadas',
    '30 dias gratis',
  ];

  protected readonly countdownUnits = computed(() => [
    { label: 'Dias', value: this.countdown().days },
    { label: 'Horas', value: this.countdown().hours },
    { label: 'Minutos', value: this.countdown().minutes },
    { label: 'Segundos', value: this.countdown().seconds },
  ]);

  ngOnInit(): void {
    this.seo.setPageMeta({
      title: 'Kronu | Preventa para barberias y peluquerias',
      description:
        'Asegura tu lugar fundador en Kronu y lanza tu negocio con reservas online, recordatorios y una pagina propia.',
      path: '/',
    });
    this.updateCountdown();
    this.timerId = setInterval(() => this.updateCountdown(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  private updateCountdown(): void {
    const diff = this.launchDate.getTime() - Date.now();

    if (diff <= 0) {
      this.launchReached.set(true);
      this.countdown.set({
        days: '00',
        hours: '00',
        minutes: '00',
        seconds: '00',
      });
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      return;
    }

    this.launchReached.set(false);

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    this.countdown.set({
      days: this.pad(days),
      hours: this.pad(hours),
      minutes: this.pad(minutes),
      seconds: this.pad(seconds),
    });
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }
}
