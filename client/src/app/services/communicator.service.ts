import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CommunicatorService {
  toggleLegend$: BehaviorSubject<{ name?: string; visible?: boolean }> = new BehaviorSubject(null);
}
